/**
 * Convert a remote or file URI to a compressed JPEG base64 data URL.
 * Used before saving inspection photos to Firestore (no Storage bucket needed).
 */
export async function uriToCompressedDataUrl(
  uri: string,
  readFileAsBase64: (fileUri: string) => Promise<string>
): Promise<string> {
  const base64 = await readFileAsBase64(uri);
  const dataUrl = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
  return dataUrl;
}

/** Ensure signature is a full data URL for inline Firestore storage. */
export function normalizeSignatureDataUrl(signatureBase64: string): string {
  if (signatureBase64.startsWith('data:')) return signatureBase64;
  return `data:image/png;base64,${signatureBase64.replace(/^data:image\/\w+;base64,/, '')}`;
}

/** Rough size check — Firestore documents max ~1 MiB. */
export function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? dataUrl;
  return Math.ceil((base64.length * 3) / 4);
}

export const FIRESTORE_DOC_SIZE_LIMIT = 1_048_576;
