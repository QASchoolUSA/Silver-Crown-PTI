import { doc, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from './config';
import type { EquipmentType } from '../types';

export async function updateDriverEquipment(
  driverId: string,
  equipmentTypes: EquipmentType[]
): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), 'users', driverId), { equipmentTypes });
}
