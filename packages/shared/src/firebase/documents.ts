import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseDb, getFirebaseStorage } from './config';
import { type CompanyDocument, type DocumentType, type ExtractedDocData } from '../types';
import { normalizeDocumentType } from '../utils/freightParser';

function mapDocument(id: string, data: Record<string, unknown>): CompanyDocument {
  const extracted = data.extractedData as ExtractedDocData | undefined;
  const rawType = (data.docType as string) || extracted?.documentType;
  const normType = normalizeDocumentType(rawType, extracted?.rawText, data.fileName as string);

  return {
    id,
    companyId: data.companyId as string,
    uploadedBy: data.uploadedBy as string,
    uploaderName: (data.uploaderName as string) || 'Unknown User',
    fileName: data.fileName as string,
    fileUrl: data.fileUrl as string,
    fileType: (data.fileType as string) || 'image/jpeg',
    docType: normType,
    status: (data.status as 'processing' | 'processed' | 'error') || 'processed',
    extractedData: extracted
      ? {
          ...extracted,
          documentType: normType,
        }
      : undefined,
    loadId: data.loadId as string | undefined,
    errorMessage: data.errorMessage as string | undefined,
    createdAt: (data.createdAt as string) || new Date().toISOString(),
  };
}

export async function getCompanyDocuments(companyId: string): Promise<CompanyDocument[]> {
  const q = query(
    collection(getFirebaseDb(), 'documents'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDocument(d.id, d.data()));
}

export function subscribeCompanyDocuments(
  companyId: string,
  callback: (docs: CompanyDocument[]) => void
): Unsubscribe {
  const q = query(
    collection(getFirebaseDb(), 'documents'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapDocument(d.id, d.data())));
    },
    (error) => {
      console.error('subscribeCompanyDocuments error:', error.code, error.message);
      callback([]);
    }
  );
}

export async function uploadDocumentFile(
  companyId: string,
  docId: string,
  file: File | Blob,
  fileName: string
): Promise<string> {
  try {
    const contentType = (file as File).type || 'image/jpeg';
    const storageRef = ref(getFirebaseStorage(), `companies/${companyId}/documents/${docId}_${fileName}`);
    const snap = await uploadBytes(storageRef, file, { contentType });
    return await getDownloadURL(snap.ref);
  } catch (err) {
    console.warn('Firebase Storage upload notice (falling back to object URL):', err);
    if (typeof window !== 'undefined' && window.URL && window.URL.createObjectURL) {
      return window.URL.createObjectURL(file);
    }
    return '';
  }
}

export interface CreateDocumentInput {
  companyId: string;
  uploadedBy: string;
  uploaderName: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  docType?: DocumentType;
  loadId?: string;
  status?: 'processing' | 'processed' | 'error';
  extractedData?: ExtractedDocData;
}

export function sanitizeFirestoreData(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeFirestoreData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function createDocumentRecord(input: CreateDocumentInput): Promise<string> {
  const rawPayload: Record<string, unknown> = {
    companyId: input.companyId,
    uploadedBy: input.uploadedBy,
    uploaderName: input.uploaderName,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    docType: input.docType || 'other',
    status: input.status || 'processing',
    loadId: input.loadId || null,
    extractedData: input.extractedData ? sanitizeFirestoreData(input.extractedData as unknown as Record<string, unknown>) : null,
    createdAt: new Date().toISOString(),
  };

  const sanitizedPayload = sanitizeFirestoreData(rawPayload);
  const docRef = await addDoc(collection(getFirebaseDb(), 'documents'), sanitizedPayload);
  return docRef.id;
}

export async function updateDocumentExtractedData(
  docId: string,
  extractedData: ExtractedDocData,
  docType?: DocumentType,
  loadId?: string
): Promise<void> {
  const sanitizedExtracted = sanitizeFirestoreData(extractedData as unknown as Record<string, unknown>);
  const updates: Record<string, unknown> = {
    extractedData: sanitizedExtracted,
    status: 'processed',
  };
  if (docType) updates.docType = docType;
  if (loadId !== undefined) updates.loadId = loadId;

  const sanitizedUpdates = sanitizeFirestoreData(updates);
  await updateDoc(doc(getFirebaseDb(), 'documents', docId), sanitizedUpdates);
}

export async function linkDocumentToLoad(docId: string, loadId: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'documents', docId), { loadId });
}

export async function deleteCompanyDocument(docId: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), 'documents', docId));
}
