import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from './config';
import type { Company } from '../types';

export async function getCompany(companyId: string): Promise<Company | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'companies', companyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Company;
}
