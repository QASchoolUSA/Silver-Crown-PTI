import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { fetchRouteWeatherForFunction, isValidCoords } from './nws';

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10 });

export const redeemInviteCode = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to redeem invite code.');
  }

  const { code, displayName } = request.data as { code: string; displayName: string };
  if (!code || !displayName) {
    throw new HttpsError('invalid-argument', 'Code and displayName are required.');
  }

  const uid = request.auth.uid;
  const normalizedCode = code.trim().toUpperCase();

  const companiesSnap = await db.collectionGroup('inviteCodes')
    .where('code', '==', normalizedCode)
    .limit(1)
    .get();

  if (companiesSnap.empty) {
    throw new HttpsError('not-found', 'Invalid invite code.');
  }

  const inviteDoc = companiesSnap.docs[0];
  const inviteData = inviteDoc.data();
  const companyId = inviteData.companyId;

  if (new Date(inviteData.expiresAt) < new Date()) {
    throw new HttpsError('failed-precondition', 'Invite code has expired.');
  }

  if (inviteData.usedCount >= inviteData.maxUses) {
    throw new HttpsError('failed-precondition', 'Invite code has already been used.');
  }

  const userRef = db.collection('users').doc(uid);
  const existingUser = await userRef.get();
  if (existingUser.exists) {
    throw new HttpsError('already-exists', 'User profile already exists.');
  }

  await db.runTransaction(async (transaction) => {
    const freshInvite = await transaction.get(inviteDoc.ref);
    const data = freshInvite.data()!;

    if (data.usedCount >= data.maxUses) {
      throw new HttpsError('failed-precondition', 'Invite code has already been used.');
    }

    transaction.set(userRef, {
      email: request.auth!.token.email || '',
      displayName,
      companyId,
      role: data.role,
      createdAt: new Date().toISOString(),
    });

    transaction.update(inviteDoc.ref, {
      usedCount: data.usedCount + 1,
    });
  });

  return { companyId, role: inviteData.role };
});

export const seedDemoData = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }

  const companyId = 'silver-crown-global';
  const companyRef = db.collection('companies').doc(companyId);

  await companyRef.set({
    name: 'Silver Crown Global',
    createdAt: new Date().toISOString(),
  }, { merge: true });

  const adminCode = 'ADMIN001';
  await companyRef.collection('inviteCodes').doc('admin-seed').set({
    code: adminCode,
    companyId,
    role: 'admin',
    createdBy: 'system',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    usedCount: 0,
    maxUses: 10,
    createdAt: new Date().toISOString(),
  });

  const driverCode = 'DRIVER01';
  await companyRef.collection('inviteCodes').doc('driver-seed').set({
    code: driverCode,
    companyId,
    role: 'driver',
    createdBy: 'system',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    usedCount: 0,
    maxUses: 100,
    createdAt: new Date().toISOString(),
  });

  return { companyId, adminCode, driverCode };
});

export const getRouteWeather = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to fetch weather.');
  }

  const { originCoords, destCoords, originLabel, destLabel } = request.data as {
    originCoords: { latitude: number; longitude: number };
    destCoords: { latitude: number; longitude: number };
    originLabel?: string;
    destLabel?: string;
  };

  if (!originCoords || !destCoords) {
    throw new HttpsError('invalid-argument', 'originCoords and destCoords are required.');
  }

  if (!isValidCoords(originCoords) || !isValidCoords(destCoords)) {
    throw new HttpsError('invalid-argument', 'Invalid coordinates.');
  }

  return fetchRouteWeatherForFunction(
    originLabel ?? 'Origin',
    originCoords,
    destLabel ?? 'Destination',
    destCoords
  );
});
