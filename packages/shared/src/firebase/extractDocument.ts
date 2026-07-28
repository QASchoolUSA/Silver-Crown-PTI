import { httpsCallable } from 'firebase/functions';
import type { ExtractedDocData } from '../types';
import { getFirebaseFunctions } from './config';

export interface ExtractDocumentDataRequest {
  documentId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  base64Data?: string;
  /** Additional rendered page images (raw or data-URL base64). */
  base64Pages?: string[];
  apiKey?: string;
}

export interface GeminiUsageMetadata {
  model: string;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface ExtractDocumentDataResponse {
  success: boolean;
  extractedData: ExtractedDocData;
  usage?: GeminiUsageMetadata;
}

export async function extractDocumentData(
  request: ExtractDocumentDataRequest
): Promise<ExtractDocumentDataResponse> {
  const callable = httpsCallable<ExtractDocumentDataRequest, ExtractDocumentDataResponse>(
    getFirebaseFunctions(),
    'extractDocumentData'
  );
  const result = await callable(request);
  return result.data;
}
