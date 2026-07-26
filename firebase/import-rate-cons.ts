/**
 * Batch rate-confirmation importer.
 *
 * Examples:
 *   pnpm import:rate-cons -- --dir "/path/to/document"
 *   pnpm import:rate-cons -- --dir "/path/to/document" --confirm --status=delivered
 *
 * Without --confirm, uploads/extracts/routs files and writes a reviewable JSON manifest.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import {
  calculateRateConRouteMiles,
  createDocumentRecord,
  createLoadsFromDrafts,
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseFunctions,
  initFirebase,
  isLikelyPodFile,
  uploadDocumentFile,
  type ExtractedDocData,
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

  console.log(`Extracting ${files.length} PDFs from ${dataDir}`);
  const drafts: RateConDraft[] = [];
  const failures: Array<{ sourceFile: string; error: string }> = [];

  for (const [index, fileName] of files.entries()) {
    process.stdout.write(`[${index + 1}/${files.length}] ${fileName} ... `);
    try {
      const bytes = fs.readFileSync(path.join(dataDir, fileName));
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
      });

      const extract = httpsCallable<
        { documentId: string; fileUrl: string; fileName: string; fileType: string },
        { success: boolean; extractedData: ExtractedDocData }
      >(getFirebaseFunctions(), 'extractDocumentData');
      const result = await extract({
        documentId,
        fileUrl,
        fileName,
        fileType: 'application/pdf',
      });
      if (
        result.data.extractedData.documentType !== 'rate_confirmation'
        || !result.data.extractedData.rateConDraft
      ) {
        throw new Error('Not recognized as a rate confirmation');
      }

      let draft: RateConDraft = {
        ...result.data.extractedData.rateConDraft,
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
