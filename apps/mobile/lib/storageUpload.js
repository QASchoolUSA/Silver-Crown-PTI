import * as FileSystem from 'expo-file-system/legacy';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage } from '@silver-crown/shared';

/** Read a local file URI as a React Native native Blob (not ArrayBuffer). */
function uriToNativeBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.response instanceof Blob) {
        resolve(xhr.response);
        return;
      }
      reject(new Error('Failed to read file as blob'));
    };
    xhr.onerror = () => reject(new Error('Failed to read file'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri);
    xhr.send();
  });
}

async function uploadViaSdk(storagePath, localUri, contentType) {
  const blob = await uriToNativeBlob(localUri);
  const storageRef = ref(getFirebaseStorage(), storagePath);
  const snapshot = await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(snapshot.ref);
}

/** Uploads via Firebase Storage SDK using native RN blobs (avoids ArrayBuffer issues). */
export const mobileStorageUploader = {
  uploadFile: uploadViaSdk,
  async uploadBase64(storagePath, base64Data, contentType) {
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const tempUri = `${FileSystem.cacheDirectory}upload-${Date.now()}.${ext}`;
    await FileSystem.writeAsStringAsync(tempUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    try {
      return await uploadViaSdk(storagePath, tempUri, contentType);
    } finally {
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    }
  },
};
