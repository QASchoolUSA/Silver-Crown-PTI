import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import { type StorageUploader, uploadStorageBase64, uploadStorageFile } from './storageUpload';
import type { Inspection, InspectionSection, InspectionStatus } from '../types';

function mapInspection(id: string, data: Record<string, unknown>): Inspection {
  return {
    id,
    companyId: data.companyId as string,
    driverId: data.driverId as string,
    driverName: data.driverName as string,
    truckNumber: data.truckNumber as string,
    trailerNumber: (data.trailerNumber as string) || null,
    status: data.status as InspectionStatus,
    sections: data.sections as InspectionSection[],
    signatureUrl: data.signatureUrl as string | undefined,
    createdAt: data.createdAt as string,
  };
}

export async function getInspectionById(inspectionId: string): Promise<Inspection | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'inspections', inspectionId));
  if (!snap.exists()) return null;
  return mapInspection(snap.id, snap.data());
}

export async function getDriverInspections(companyId: string, driverId: string): Promise<Inspection[]> {
  const q = query(
    collection(getFirebaseDb(), 'inspections'),
    where('companyId', '==', companyId),
    where('driverId', '==', driverId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapInspection(d.id, d.data()));
}

export function subscribeDriverInspections(
  companyId: string,
  driverId: string,
  callback: (inspections: Inspection[]) => void
): Unsubscribe {
  const q = query(
    collection(getFirebaseDb(), 'inspections'),
    where('companyId', '==', companyId),
    where('driverId', '==', driverId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapInspection(d.id, d.data())));
    },
    (error) => {
      console.error('subscribeDriverInspections error:', error.code, error.message);
      callback([]);
    }
  );
}

export async function getCompanyInspections(companyId: string): Promise<Inspection[]> {
  const q = query(
    collection(getFirebaseDb(), 'inspections'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapInspection(d.id, d.data()));
}

export function subscribeCompanyInspections(
  companyId: string,
  callback: (inspections: Inspection[]) => void
): Unsubscribe {
  const q = query(
    collection(getFirebaseDb(), 'inspections'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapInspection(d.id, d.data())));
    },
    (error) => {
      console.error('subscribeCompanyInspections error:', error.code, error.message);
      callback([]);
    }
  );
}

function sanitizePhotoFileName(itemKey: string): string {
  return itemKey.replace(/::/g, '_').replace(/[^\w.-]+/g, '_');
}

function inspectionStorageBase(companyId: string, driverId: string, inspectionId: string): string {
  return `companies/${companyId}/drivers/${driverId}/inspections/${inspectionId}`;
}

function photoStoragePath(companyId: string, driverId: string, inspectionId: string, itemKey: string): string {
  return `${inspectionStorageBase(companyId, driverId, inspectionId)}/photos/${sanitizePhotoFileName(itemKey)}.jpg`;
}

function signatureStoragePath(companyId: string, driverId: string, inspectionId: string): string {
  return `${inspectionStorageBase(companyId, driverId, inspectionId)}/signature.png`;
}

export interface CreateInspectionInput {
  companyId: string;
  driverId: string;
  driverName: string;
  truckNumber: string;
  trailerNumber: string | null;
  status: InspectionStatus;
  sections: InspectionSection[];
  signatureBase64: string;
  photoUris: Record<string, string>;
  storageUploader: StorageUploader;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefined(entry)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    ) as T;
  }
  return value;
}

export async function createInspection(input: CreateInspectionInput): Promise<string> {
  const docRef = await addDoc(
    collection(getFirebaseDb(), 'inspections'),
    stripUndefined({
      companyId: input.companyId,
      driverId: input.driverId,
      driverName: input.driverName,
      truckNumber: input.truckNumber,
      trailerNumber: input.trailerNumber,
      status: input.status,
      sections: input.sections,
      createdAt: new Date().toISOString(),
    })
  );

  const inspectionId = docRef.id;
  const uploadContext = { companyId: input.companyId, driverId: input.driverId };
  const updatedSections = input.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item })),
  }));

  try {
    for (const [key, uri] of Object.entries(input.photoUris)) {
      const path = photoStoragePath(input.companyId, input.driverId, inspectionId, key);
      const photoUrl = await uploadStorageFile(path, uri, 'image/jpeg', input.storageUploader, uploadContext);
      const [sectionId, itemName] = key.split('::');
      const section = updatedSections.find((s) => s.id === sectionId);
      if (section) {
        const item = section.items.find((i) => i.name === itemName);
        if (item) item.photoUrl = photoUrl;
      }
    }

    const signatureUrl = await uploadStorageBase64(
      signatureStoragePath(input.companyId, input.driverId, inspectionId),
      input.signatureBase64,
      'image/png',
      input.storageUploader,
      uploadContext
    );

    await updateDoc(
      doc(getFirebaseDb(), 'inspections', inspectionId),
      stripUndefined({
        sections: updatedSections,
        signatureUrl,
      })
    );

    return inspectionId;
  } catch (error) {
    await deleteDoc(doc(getFirebaseDb(), 'inspections', inspectionId)).catch(() => undefined);
    throw error;
  }
}

export function formatInspectionDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
