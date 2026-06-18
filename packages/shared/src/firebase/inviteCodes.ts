import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import type { InviteCode, UserRole, AppUser } from '../types';

function generateCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function generateInviteCode(
  companyId: string,
  role: UserRole,
  createdBy: string,
  maxUses = 1,
  expiresInDays = 30
): Promise<InviteCode> {
  const code = generateCodeString();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const ref = await addDoc(collection(getFirebaseDb(), `companies/${companyId}/inviteCodes`), {
    code,
    companyId,
    role,
    createdBy,
    expiresAt: expiresAt.toISOString(),
    usedCount: 0,
    maxUses,
    createdAt: new Date().toISOString(),
  });

  return {
    id: ref.id,
    code,
    companyId,
    role,
    createdBy,
    expiresAt: expiresAt.toISOString(),
    usedCount: 0,
    maxUses,
    createdAt: new Date().toISOString(),
  };
}

export async function getCompanyInviteCodes(companyId: string): Promise<InviteCode[]> {
  const q = query(
    collection(getFirebaseDb(), `companies/${companyId}/inviteCodes`),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InviteCode));
}

export async function getCompanyDrivers(companyId: string): Promise<AppUser[]> {
  const q = query(
    collection(getFirebaseDb(), 'users'),
    where('companyId', '==', companyId),
    where('role', '==', 'driver')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
}

export async function getCompanyUsers(companyId: string): Promise<AppUser[]> {
  const q = query(collection(getFirebaseDb(), 'users'), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
}
