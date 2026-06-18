import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseAuth, getFirebaseDb, getFirebaseFunctions } from './config';
import type { AppUser } from '../types';

export async function signIn(email: string, password: string) {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return result.user;
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  inviteCode: string
): Promise<FirebaseUser> {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await updateProfile(result.user, { displayName });

  const redeemInviteCode = httpsCallable(getFirebaseFunctions(), 'redeemInviteCode');
  await redeemInviteCode({ code: inviteCode, displayName });

  return result.user;
}

export async function signOut() {
  await firebaseSignOut(getFirebaseAuth());
}

export function subscribeToAuthState(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as AppUser;
}

export async function getCurrentUserProfile(): Promise<AppUser | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return getUserProfile(user.uid);
}
