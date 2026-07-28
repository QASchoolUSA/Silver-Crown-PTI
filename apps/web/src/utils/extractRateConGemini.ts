import {
  extractDocumentData,
  isUsableRateConDraft,
  optimizeDocumentImageForOCR,
  reconcileRateConDraft,
  type ExtractedDocData,
  type RateConDraft,
} from '@silver-crown/shared';

export interface GeminiRateConExtractResult {
  draft: RateConDraft;
  extractedData: ExtractedDocData;
  source: 'gemini';
  usage?: {
    model: string;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
}

function stripDataUrl(b64: string): string {
  return b64.replace(/^data:[^;]+;base64,/, '');
}

async function blobToJpegBase64(blob: Blob, quality = 0.8): Promise<string> {
  if (blob.type === 'image/jpeg') {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(img, 0, 0);
      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality)
      );
      if (!jpeg) throw new Error('JPEG encode failed');
      return blobToJpegBase64(jpeg, quality);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Render page 1 only at moderate DPI to cut Gemini image-token cost.
 * Rate-con money/stops are almost always on page 1.
 */
async function renderPdfPagesToJpegBase64(
  file: File | Blob,
  onProgress?: (message: string) => void
): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageLimit = Math.min(doc.numPages, 1);
  const pages: string[] = [];

  for (let i = 1; i <= pageLimit; i++) {
    onProgress?.(`Rendering page ${i} for Gemini…`);
    const page = await doc.getPage(i);
    // ~108–144 DPI equivalent — enough for rate-con print, cheaper than scale 2
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) continue;
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.8)
    );
    if (!blob) continue;
    pages.push(await blobToJpegBase64(blob, 0.8));
  }

  return pages;
}

async function imageFileToJpegPages(
  file: File | Blob,
  onProgress?: (message: string) => void
): Promise<string[]> {
  onProgress?.('Preparing image for Gemini…');
  const { base64Data } = await optimizeDocumentImageForOCR(file, 1600);
  return [stripDataUrl(base64Data)];
}

/**
 * Multimodal Gemini extract via Cloud Function (cost-tuned: 1 page, mid DPI, lite models).
 */
export async function extractRateConGemini(
  file: File,
  options: {
    documentId: string;
    fileUrl: string;
    onProgress?: (message: string) => void;
  }
): Promise<GeminiRateConExtractResult> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  options.onProgress?.('Preparing document for Gemini vision…');
  const base64Pages = isPdf
    ? await renderPdfPagesToJpegBase64(file, options.onProgress)
    : await imageFileToJpegPages(file, options.onProgress);

  if (!base64Pages.length) {
    throw new Error('Could not render document pages for Gemini.');
  }

  options.onProgress?.('Running Gemini multimodal vision…');
  const response = await extractDocumentData({
    documentId: options.documentId,
    fileUrl: options.fileUrl,
    fileName: file.name,
    fileType: 'image/jpeg',
    base64Data: base64Pages[0],
    base64Pages,
  });

  if (response.usage) {
    console.info('[extractRateConGemini] usage', response.usage);
  }

  const extracted = response.extractedData;
  let draft = extracted.rateConDraft
    ? reconcileRateConDraft({
        ...extracted.rateConDraft,
        sourceFile: file.name,
        documentId: options.documentId,
      })
    : null;

  if (!isUsableRateConDraft(draft)) {
    throw new Error('Gemini did not return a usable rate confirmation draft.');
  }

  draft = draft!;
  const extractedData: ExtractedDocData = {
    ...extracted,
    documentType: 'rate_confirmation',
    rateConDraft: draft,
    confidence: draft.confidence ?? extracted.confidence,
  };

  return { draft, extractedData, source: 'gemini', usage: response.usage };
}
