import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseDb, getFirebaseStorage } from './config';
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

async function uploadPhoto(
  companyId: string,
  inspectionId: string,
  itemKey: string,
  uri: string,
  fetchBlob: (uri: string) => Promise<Blob>
): Promise<string> {
  const blob = await fetchBlob(uri);
  const storageRef = ref(
    getFirebaseStorage(),
    `companies/${companyId}/inspections/${inspectionId}/photos/${itemKey.replace(/::/g, '_')}.jpg`
  );
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

async function uploadSignature(
  companyId: string,
  inspectionId: string,
  signatureBase64: string
): Promise<string> {
  const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const storageRef = ref(
    getFirebaseStorage(),
    `companies/${companyId}/inspections/${inspectionId}/signature.png`
  );
  await uploadBytes(storageRef, bytes, { contentType: 'image/png' });
  return getDownloadURL(storageRef);
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
  fetchBlob: (uri: string) => Promise<Blob>;
}

export async function createInspection(input: CreateInspectionInput): Promise<string> {
  const docRef = await addDoc(collection(getFirebaseDb(), 'inspections'), {
    companyId: input.companyId,
    driverId: input.driverId,
    driverName: input.driverName,
    truckNumber: input.truckNumber,
    trailerNumber: input.trailerNumber,
    status: input.status,
    sections: input.sections,
    createdAt: new Date().toISOString(),
  });

  const inspectionId = docRef.id;
  const updatedSections = input.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item })),
  }));

  for (const [key, uri] of Object.entries(input.photoUris)) {
    const photoUrl = await uploadPhoto(input.companyId, inspectionId, key, uri, input.fetchBlob);
    const [sectionId, itemName] = key.split('::');
    const section = updatedSections.find((s) => s.id === sectionId);
    if (section) {
      const item = section.items.find((i) => i.name === itemName);
      if (item) item.photoUrl = photoUrl;
    }
  }

  const signatureUrl = await uploadSignature(input.companyId, inspectionId, input.signatureBase64);

  await updateDoc(doc(getFirebaseDb(), 'inspections', inspectionId), {
    sections: updatedSections,
    signatureUrl,
  });

  return inspectionId;
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
