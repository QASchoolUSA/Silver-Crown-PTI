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
import { getFirebaseDb } from './config';
import type { Load, LoadStatus, EquipmentType } from '../types';

function mapLoad(id: string, data: Record<string, unknown>): Load {
  return {
    id,
    companyId: data.companyId as string,
    assignedDriverId: (data.assignedDriverId as string) || null,
    assignedDriverName: data.assignedDriverName as string | undefined,
    origin: data.origin as string,
    destination: data.destination as string,
    payout: data.payout as string,
    miles: data.miles as string,
    deadhead: data.deadhead as string | undefined,
    type: data.type as EquipmentType,
    status: data.status as LoadStatus,
    originCoords: data.originCoords as Load['originCoords'],
    destCoords: data.destCoords as Load['destCoords'],
    deliveryDate: data.deliveryDate as string | undefined,
    createdAt: data.createdAt as string,
  };
}

export async function getDriverLoads(companyId: string, driverId: string): Promise<Load[]> {
  const q = query(
    collection(getFirebaseDb(), 'loads'),
    where('companyId', '==', companyId),
    where('assignedDriverId', '==', driverId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapLoad(d.id, d.data()));
}

export function subscribeDriverLoads(
  companyId: string,
  driverId: string,
  callback: (loads: Load[]) => void
): Unsubscribe {
  const q = query(
    collection(getFirebaseDb(), 'loads'),
    where('companyId', '==', companyId),
    where('assignedDriverId', '==', driverId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapLoad(d.id, d.data())));
    },
    (error) => {
      console.error('subscribeDriverLoads error:', error.code, error.message);
      callback([]);
    }
  );
}

export async function getCompanyLoads(companyId: string): Promise<Load[]> {
  const q = query(
    collection(getFirebaseDb(), 'loads'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapLoad(d.id, d.data()));
}

export function subscribeCompanyLoads(
  companyId: string,
  callback: (loads: Load[]) => void
): Unsubscribe {
  const q = query(
    collection(getFirebaseDb(), 'loads'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapLoad(d.id, d.data())));
    },
    (error) => {
      console.error('subscribeCompanyLoads error:', error.code, error.message);
      callback([]);
    }
  );
}

export async function getLoadsByDriver(companyId: string, driverId: string): Promise<Load[]> {
  const q = query(
    collection(getFirebaseDb(), 'loads'),
    where('companyId', '==', companyId),
    where('assignedDriverId', '==', driverId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapLoad(d.id, d.data()));
}

export async function getLoadById(loadId: string): Promise<Load | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'loads', loadId));
  if (!snap.exists()) return null;
  return mapLoad(snap.id, snap.data());
}

export interface CreateLoadInput {
  companyId: string;
  assignedDriverId?: string | null;
  assignedDriverName?: string;
  origin: string;
  destination: string;
  payout: string;
  miles: string;
  deadhead?: string;
  type: EquipmentType;
  status?: LoadStatus;
  originCoords: Load['originCoords'];
  destCoords: Load['destCoords'];
}

export async function createLoad(input: CreateLoadInput): Promise<string> {
  const ref = await addDoc(collection(getFirebaseDb(), 'loads'), {
    ...input,
    assignedDriverId: input.assignedDriverId || null,
    status: input.status || 'available',
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function assignLoadToDriver(
  loadId: string,
  driverId: string,
  driverName: string
): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'loads', loadId), {
    assignedDriverId: driverId,
    assignedDriverName: driverName,
  });
}

export async function updateLoadStatus(loadId: string, status: LoadStatus, deliveryDate?: string) {
  const updates: Record<string, unknown> = { status };
  if (deliveryDate) updates.deliveryDate = deliveryDate;
  await updateDoc(doc(getFirebaseDb(), 'loads', loadId), updates);
}
