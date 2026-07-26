/**
 * Batch rate-confirmation importer (free hybrid extract — no Gemini).
 *
 * Examples:
 *   pnpm import:rate-cons -- --dir "/path/to/document"
 *   pnpm import:rate-cons -- --dir "/path/to/document" --confirm --status=delivered
 *
 * Without --confirm, uploads/extracts files and writes a reviewable JSON manifest.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  calculateRateConRouteMiles,
  createDocumentRecord,
  createLoadsFromDrafts,
  getFirebaseAuth,
  getFirebaseDb,
  initFirebase,
  isLikelyPodFile,
  parseRateConfirmation,
  updateDocumentExtractedData,
  uploadDocumentFile,
  type LoadStatus,
  type RateConDraft,
} from '../packages/shared/src';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
const readArg = (name: string) => {
  const exact = args.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const dataDir =
  readArg('--dir')
  || path.join(
    process.env.SPRINTERSTATE_DATA_DIR
      || '/Users/kedrovnick/sprinterstate-downloader/downloads/Alexey Kedrov - 797',
    'document'
  );
const shouldConfirm = args.includes('--confirm');
const status = (readArg('--status') || 'available') as LoadStatus;
const outputPath = readArg('--output') || path.resolve(process.cwd(), 'rate-con-import-drafts.json');

async function extractPdfText(bytes: Buffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(bytes), disableWorker: true }).promise;
  const pages: string[] = [];
  const limit = Math.min(doc.numPages, 8);
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let pageText = '';
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const y = Array.isArray(item.transform) ? Number(item.transform[5]) : null;
      if (lastY != null && y != null && Math.abs(lastY - y) > 2) {
        pageText += '\n';
      } else if (pageText && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
        pageText += ' ';
      }
      pageText += item.str;
      if (y != null) lastY = y;
    }
    pages.push(pageText);
  }
  return pages.join('\n');
}

async function main() {
  if (!fs.existsSync(dataDir)) throw new Error(`Directory not found: ${dataDir}`);
  if (!['available', 'in_transit', 'delivered'].includes(status)) {
    throw new Error(`Invalid --status: ${status}`);
  }

  initFirebase({
    apiKey: env('EXPO_PUBLIC_FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'),
    authDomain: env('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: env('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'),
    storageBucket: env('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: env(
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_MESSAGING_SENDER_ID'
    ),
    appId: env('EXPO_PUBLIC_FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'),
    useEmulators: process.env.USE_FIREBASE_EMULATORS === 'true',
  });

  const email = process.env.IMPORT_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const password = process.env.IMPORT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set IMPORT_ADMIN_EMAIL and IMPORT_ADMIN_PASSWORD in .env.');
  }

  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  const profile = await getDoc(doc(getFirebaseDb(), 'users', credential.user.uid));
  const companyId = profile.data()?.companyId as string | undefined;
  if (!companyId || profile.data()?.role !== 'admin') {
    throw new Error('The import account must have an admin company profile.');
  }

  const files = fs.readdirSync(dataDir)
    .filter((fileName) => /\.pdf$/i.test(fileName) && !isLikelyPodFile(fileName))
    .sort();
  if (files.length === 0) throw new Error('No rate-confirmation PDF candidates found.');

  console.log(`Extracting ${files.length} PDFs from ${dataDir} (free hybrid parser)`);
  const drafts: RateConDraft[] = [];
  const failures: Array<{ sourceFile: string; error: string }> = [];

  for (const [index, fileName] of files.entries()) {
    process.stdout.write(`[${index + 1}/${files.length}] ${fileName} ... `);
    try {
      const bytes = fs.readFileSync(path.join(dataDir, fileName));
      const rawText = await extractPdfText(bytes);
      const parsed = parseRateConfirmation(rawText, fileName);
      if (parsed.documentType !== 'rate_confirmation' || !parsed.draft) {
        throw new Error(
          parsed.documentType === 'proof_of_delivery'
            ? 'Looks like a POD'
            : 'Not recognized as a rate confirmation'
        );
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const storageKey = `ratecon_batch_${Date.now()}_${index}`;
      const fileUrl = await uploadDocumentFile(companyId, storageKey, blob, fileName);
      const documentId = await createDocumentRecord({
        companyId,
        uploadedBy: credential.user.uid,
        uploaderName: profile.data()?.displayName || email,
        fileName,
        fileUrl,
        fileType: 'application/pdf',
        docType: 'rate_confirmation',
        status: 'processing',
        extractedData: {
          documentType: 'rate_confirmation',
          rateConfirmationNumber: parsed.draft.loadRef,
          totalRate: parsed.draft.payout ? `$${parsed.draft.payout}` : undefined,
          pickupDate: parsed.draft.pickupDate,
          deliveryDate: parsed.draft.deliveryDate,
          rawText: parsed.rawText,
          confidence: parsed.confidence,
          rateConDraft: { ...parsed.draft, sourceFile: fileName },
        },
      });
      await updateDocumentExtractedData(
        documentId,
        {
          documentType: 'rate_confirmation',
          rateConfirmationNumber: parsed.draft.loadRef,
          totalRate: parsed.draft.payout ? `$${parsed.draft.payout}` : undefined,
          pickupDate: parsed.draft.pickupDate,
          deliveryDate: parsed.draft.deliveryDate,
          rawText: parsed.rawText,
          confidence: parsed.confidence,
          rateConDraft: { ...parsed.draft, sourceFile: fileName, documentId },
        },
        'rate_confirmation'
      );

      let draft: RateConDraft = {
        ...parsed.draft,
        sourceFile: fileName,
        documentId,
      };
      if (!draft.miles && draft.stops.length >= 2) {
        try {
          const route = await calculateRateConRouteMiles(draft.stops);
          draft = {
            ...draft,
            stops: route.stops,
            miles: String(route.miles),
            milesSource: 'geoapify',
          };
        } catch (error) {
          draft.warnings = [
            ...(draft.warnings || []),
            error instanceof Error ? error.message : 'Route calculation failed.',
          ];
        }
      }
      drafts.push(draft);
      console.log('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ sourceFile: fileName, error: message });
      console.log(`failed: ${message}`);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), drafts, failures }, null, 2));
  console.log(`Wrote ${drafts.length} drafts to ${outputPath}`);

  if (shouldConfirm) {
    const result = await createLoadsFromDrafts(companyId, drafts, { status });
    console.log(`Created ${result.created.length}; skipped ${result.skipped.length}.`);
    for (const skipped of result.skipped) {
      console.log(`Skipped ${skipped.draft.sourceFile}: ${skipped.reason}`);
    }
  } else {
    console.log('Review the manifest, then rerun with --confirm to create valid loads.');
  }
}

function env(primary: string, fallback: string): string {
  const value = process.env[primary] || process.env[fallback];
  if (!value) throw new Error(`Missing ${primary} in .env.`);
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
