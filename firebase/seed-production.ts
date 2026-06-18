/**
 * Seed demo data into the production Firebase project.
 *
 * Requires Admin credentials (service account key or gcloud auth).
 * Run: pnpm seed:production
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { initAdminApp, ADMIN_CREDENTIALS_HELP } from './admin-credentials';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error('Set EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env');
}

initAdminApp(projectId);

const auth = admin.auth();
const db = admin.firestore();

const COMPANY_ID = 'silver-crown-global';

type DemoUser = {
  email: string;
  password: string;
  displayName: string;
  role: 'admin' | 'driver';
};

const DEMO_USERS: DemoUser[] = [
  { email: 'admin@silvercrown.com', password: 'password123', displayName: 'Admin User', role: 'admin' },
  { email: 'driver1@silvercrown.com', password: 'password123', displayName: 'John Driver', role: 'driver' },
  { email: 'driver2@silvercrown.com', password: 'password123', displayName: 'Jane Driver', role: 'driver' },
];

async function ensureAuthUser(user: DemoUser) {
  try {
    const existing = await auth.getUserByEmail(user.email);
    await auth.updateUser(existing.uid, { password: user.password, displayName: user.displayName });
    return existing.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'auth/user-not-found') throw error;
    const created = await auth.createUser({
      email: user.email,
      password: user.password,
      displayName: user.displayName,
    });
    return created.uid;
  }
}

async function seed() {
  console.log(`Seeding production project: ${projectId}`);

  try {
    await auth.listUsers(1);
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = (error as Error).message || String(error);
    if (code === 'auth/configuration-not-found') {
      throw new Error(
        [
          'Firebase Authentication is not enabled for this project.',
          '',
          '1. Open Firebase Console → silver-crown-app → Authentication',
          '2. Click "Get started"',
          '3. Sign-in method → Email/Password → Enable → Save',
          '4. Run: pnpm seed:production',
        ].join('\n')
      );
    }
    if (message.includes('credential') || message.includes('Could not load')) {
      throw new Error(ADMIN_CREDENTIALS_HELP);
    }
    throw error;
  }

  await db.collection('companies').doc(COMPANY_ID).set({
    name: 'Silver Crown Global',
    createdAt: new Date().toISOString(),
  }, { merge: true });

  await db.doc(`companies/${COMPANY_ID}/inviteCodes/admin-seed`).set({
    code: 'ADMIN001',
    companyId: COMPANY_ID,
    role: 'admin',
    createdBy: 'system',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    usedCount: 0,
    maxUses: 10,
    createdAt: new Date().toISOString(),
  }, { merge: true });

  await db.doc(`companies/${COMPANY_ID}/inviteCodes/driver-seed`).set({
    code: 'DRIVER01',
    companyId: COMPANY_ID,
    role: 'driver',
    createdBy: 'system',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    usedCount: 0,
    maxUses: 100,
    createdAt: new Date().toISOString(),
  }, { merge: true });

  const uids: Record<string, string> = {};
  for (const user of DEMO_USERS) {
    const uid = await ensureAuthUser(user);
    uids[user.email] = uid;
    await db.collection('users').doc(uid).set({
      email: user.email,
      displayName: user.displayName,
      companyId: COMPANY_ID,
      role: user.role,
      createdAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`  ✓ ${user.email} (${user.role})`);
  }

  const loadsSnap = await db.collection('loads').where('companyId', '==', COMPANY_ID).limit(1).get();
  if (loadsSnap.empty) {
    const loads = [
      {
        companyId: COMPANY_ID,
        assignedDriverId: uids['driver1@silvercrown.com'],
        assignedDriverName: 'John Driver',
        origin: 'Chicago, IL',
        destination: 'Dallas, TX',
        payout: '2,400',
        miles: '920',
        deadhead: '45',
        type: 'Dry Van',
        status: 'available',
        originCoords: { latitude: 41.8781, longitude: -87.6298 },
        destCoords: { latitude: 32.7767, longitude: -96.7970 },
        createdAt: new Date().toISOString(),
      },
      {
        companyId: COMPANY_ID,
        assignedDriverId: uids['driver2@silvercrown.com'],
        assignedDriverName: 'Jane Driver',
        origin: 'Seattle, WA',
        destination: 'Los Angeles, CA',
        payout: '3,100',
        miles: '1135',
        deadhead: '80',
        type: 'Flatbed',
        status: 'available',
        originCoords: { latitude: 47.6062, longitude: -122.3321 },
        destCoords: { latitude: 34.0522, longitude: -118.2437 },
        createdAt: new Date().toISOString(),
      },
    ];
    for (const load of loads) {
      await db.collection('loads').add(load);
    }
    console.log(`  ✓ ${loads.length} demo loads`);
  }

  console.log('\nProduction seed complete!');
  console.log('Admin: admin@silvercrown.com / password123');
  console.log('Driver: driver1@silvercrown.com / password123');
}

seed().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
