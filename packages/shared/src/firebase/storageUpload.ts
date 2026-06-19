import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseStorage, getStorageBucketName, getStorageUsesEmulators } from './config';

export interface StorageUploadContext {
  companyId: string;
  driverId: string;
}

export interface StorageUploader {
  uploadFile(
    storagePath: string,
    localUri: string,
    contentType: string,
    context: StorageUploadContext
  ): Promise<string>;
  uploadBase64(
    storagePath: string,
    base64Data: string,
    contentType: string,
    context: StorageUploadContext
  ): Promise<string>;
}

function stripBase64Prefix(data: string): string {
  return data.replace(/^data:image\/\w+;base64,/, '');
}

export function buildStorageMediaUploadUrl(storagePath: string): string {
  const bucket = getStorageBucketName();
  const encodedPath = encodeURIComponent(storagePath);
  if (getStorageUsesEmulators()) {
    return `http://127.0.0.1:9199/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}`;
  }
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}`;
}

export async function getStorageAuthHeaders(): Promise<Record<string, string>> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return { Authorization: `Firebase ${token}` };
}

export async function getStorageDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), storagePath));
}

export async function uploadStorageFile(
  storagePath: string,
  localUri: string,
  contentType: string,
  uploader: StorageUploader,
  context: StorageUploadContext
): Promise<string> {
  return uploader.uploadFile(storagePath, localUri, contentType, context);
}

export async function uploadStorageBase64(
  storagePath: string,
  base64Data: string,
  contentType: string,
  uploader: StorageUploader,
  context: StorageUploadContext
): Promise<string> {
  return uploader.uploadBase64(storagePath, stripBase64Prefix(base64Data), contentType, context);
}

/** Web uploader — uses fetch + Blob, which works in browsers but not React Native. */
export function createWebStorageUploader(): StorageUploader {
  return {
    async uploadFile(storagePath, localUri, contentType) {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const storageRef = ref(getFirebaseStorage(), storagePath);
      const snapshot = await uploadBytes(storageRef, blob, { contentType });
      return getDownloadURL(snapshot.ref);
    },
    async uploadBase64(storagePath, base64Data, contentType) {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: contentType });
      const storageRef = ref(getFirebaseStorage(), storagePath);
      const snapshot = await uploadBytes(storageRef, blob, { contentType });
      return getDownloadURL(snapshot.ref);
    },
  };
}
