import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import type {
  MaintenanceCategory,
  MaintenanceLog,
  MaintenanceLogInput,
  MaintenanceUnitType,
} from '../types';

function mapLog(id: string, data: Record<string, unknown>): MaintenanceLog {
  return {
    id,
    companyId: data.companyId as string,
    unitType: data.unitType as MaintenanceUnitType,
    unitNumber: data.unitNumber as string,
    serviceDate: data.serviceDate as string,
    category: data.category as MaintenanceCategory,
    description: data.description as string,
    odometerMiles: (data.odometerMiles as number | null | undefined) ?? null,
    shopName: (data.shopName as string | null | undefined) ?? null,
    cost: (data.cost as number | null | undefined) ?? null,
    performedByName: data.performedByName as string,
    createdByUid: data.createdByUid as string,
    notes: (data.notes as string | null | undefined) ?? null,
    createdAt: data.createdAt as string,
  };
}

export function subscribeCompanyMaintenanceLogs(
  companyId: string,
  callback: (logs: MaintenanceLog[]) => void
): Unsubscribe {
  const q = query(
    collection(getFirebaseDb(), 'maintenanceLogs'),
    where('companyId', '==', companyId),
    orderBy('serviceDate', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => mapLog(d.id, d.data())));
    },
    (error) => {
      console.error('subscribeCompanyMaintenanceLogs error:', error.code, error.message);
      callback([]);
    }
  );
}

export async function getMaintenanceLogById(logId: string): Promise<MaintenanceLog | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'maintenanceLogs', logId));
  if (!snap.exists()) return null;
  return mapLog(snap.id, snap.data());
}

export async function createMaintenanceLog(input: MaintenanceLogInput): Promise<string> {
  const ref = await addDoc(collection(getFirebaseDb(), 'maintenanceLogs'), {
    ...input,
    odometerMiles: input.odometerMiles ?? null,
    shopName: input.shopName ?? null,
    cost: input.cost ?? null,
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function updateMaintenanceLog(
  logId: string,
  patch: Partial<
    Pick<
      MaintenanceLog,
      | 'unitType'
      | 'unitNumber'
      | 'serviceDate'
      | 'category'
      | 'description'
      | 'odometerMiles'
      | 'shopName'
      | 'cost'
      | 'performedByName'
      | 'notes'
    >
  >
): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'maintenanceLogs', logId), patch);
}

export async function deleteMaintenanceLog(logId: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), 'maintenanceLogs', logId));
}
