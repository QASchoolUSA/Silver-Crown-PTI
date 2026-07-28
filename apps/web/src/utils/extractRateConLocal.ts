import {
  optimizeDocumentImageForOCR,
  parseRateConfirmation,
  reconcileRateConDraft,
  updateDocumentExtractedData,
  type ExtractedDocData,
  type RateConDraft,
} from '@silver-crown/shared';
import { runLocalDocumentOcr } from './tesseractOcr';

const SPARSE_TEXT_THRESHOLD = 80;

export interface LocalRateConExtractResult {
  draft: RateConDraft;
  extractedData: ExtractedDocData;
  source: 'pdf_text' | 'ocr';
}

async function extractPdfText(file: File | Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Vite resolves the worker URL for browser builds.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  const pageLimit = Math.min(doc.numPages, 8);
  for (let i = 1; i <= pageLimit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let pageText = '';
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const y = Array.isArray(item.transform) ? item.transform[5] : null;
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

async function renderPdfPagesForOcr(
  file: File | Blob,
  onProgress?: (message: string) => void
): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageLimit = Math.min(doc.numPages, 2);
  const chunks: string[] = [];

  for (let i = 1; i <= pageLimit; i++) {
    onProgress?.(`OCR page ${i} of ${pageLimit}…`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) continue;
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    );
    if (!blob) continue;
    const { base64Data, mimeType } = await optimizeDocumentImageForOCR(blob, 2400);
    const src = base64Data.startsWith('data:')
      ? base64Data
      : `data:${mimeType};base64,${base64Data}`;
    const ocr = await runLocalDocumentOcr(src);
    chunks.push(ocr.rawText);
  }

  return chunks.join('\n');
}

async function extractImageText(
  file: File | Blob,
  onProgress?: (message: string) => void
): Promise<string> {
  onProgress?.('Enhancing image for OCR…');
  const { base64Data, mimeType } = await optimizeDocumentImageForOCR(file, 2400);
  const src = base64Data.startsWith('data:')
    ? base64Data
    : `data:${mimeType};base64,${base64Data}`;
  onProgress?.('Running on-device OCR…');
  const ocr = await runLocalDocumentOcr(src, onProgress);
  return ocr.rawText;
}

/**
 * Free hybrid extract: PDF text → OCR if sparse → deterministic rate-con parser.
 */
export async function extractRateConLocal(
  file: File,
  options: {
    documentId: string;
    onProgress?: (message: string) => void;
  }
): Promise<LocalRateConExtractResult> {
  const isPdf =
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  let rawText = '';
  let source: LocalRateConExtractResult['source'] = 'pdf_text';

  if (isPdf) {
    options.onProgress?.('Extracting PDF text…');
    try {
      rawText = await extractPdfText(file);
    } catch (error) {
      console.warn('PDF text extract failed, falling back to OCR:', error);
      rawText = '';
    }
    if (rawText.trim().length < SPARSE_TEXT_THRESHOLD) {
      source = 'ocr';
      options.onProgress?.('PDF text sparse — running OCR…');
      rawText = await renderPdfPagesForOcr(file, options.onProgress);
    }
  } else {
    source = 'ocr';
    rawText = await extractImageText(file, options.onProgress);
  }

  options.onProgress?.('Parsing rate confirmation…');
  const parsed = parseRateConfirmation(rawText, file.name);
  if (parsed.documentType !== 'rate_confirmation' || !parsed.draft) {
    throw new Error(
      parsed.documentType === 'proof_of_delivery'
        ? 'This file looks like a POD, not a rate confirmation.'
        : 'This file was not recognized as a rate confirmation.'
    );
  }

  const draft: RateConDraft = reconcileRateConDraft({
    ...parsed.draft,
    sourceFile: file.name,
    documentId: options.documentId,
  });

  const extractedData: ExtractedDocData = {
    documentType: 'rate_confirmation',
    rateConfirmationNumber: draft.loadRef,
    carrierName: undefined,
    shipperName: draft.stops.find((s) => s.type === 'pickup')?.address,
    consigneeName: draft.stops.find((s) => s.type === 'dropoff')?.address,
    originAddress: draft.stops.find((s) => s.type === 'pickup')?.address,
    destinationAddress: [...draft.stops].reverse().find((s) => s.type === 'dropoff')?.address,
    pickupDate: draft.pickupDate,
    deliveryDate: draft.deliveryDate,
    totalRate: draft.payout ? `$${draft.payout}` : undefined,
    weight: draft.weight,
    rawText: parsed.rawText,
    confidence: draft.confidence ?? parsed.confidence,
    rateConDraft: draft,
  };

  await updateDocumentExtractedData(
    options.documentId,
    extractedData,
    'rate_confirmation'
  );

  return { draft, extractedData, source };
}
