/**
 * Seed script for Firebase emulators.
 * Run: USE_FIREBASE_EMULATORS=true pnpm seed
 */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const config = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: 'silver-crown-pti',
  storageBucket: 'silver-crown-pti.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123',
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

const COMPANY_ID = 'silver-crown-global';

async function seed() {
  console.log('Seeding demo data...');

  const companyRef = doc(db, 'companies', COMPANY_ID);
  await setDoc(companyRef, {
    name: 'Silver Crown Global',
    createdAt: new Date().toISOString(),
  });

  await setDoc(doc(db, `companies/${COMPANY_ID}/inviteCodes`, 'admin-seed'), {
    code: 'ADMIN001',
    companyId: COMPANY_ID,
    role: 'admin',
    createdBy: 'system',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    usedCount: 0,
    maxUses: 10,
    createdAt: new Date().toISOString(),
  });

  await setDoc(doc(db, `companies/${COMPANY_ID}/inviteCodes`, 'driver-seed'), {
    code: 'DRIVER01',
    companyId: COMPANY_ID,
    role: 'driver',
    createdBy: 'system',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    usedCount: 0,
    maxUses: 100,
    createdAt: new Date().toISOString(),
  });

  // Create admin user
  let adminUser;
  try {
    const cred = await createUserWithEmailAndPassword(auth, 'admin@silvercrown.com', 'password123');
    adminUser = cred.user;
  } catch {
    const cred = await signInWithEmailAndPassword(auth, 'admin@silvercrown.com', 'password123');
    adminUser = cred.user;
  }

  await setDoc(doc(db, 'users', adminUser.uid), {
    email: 'admin@silvercrown.com',
    displayName: 'Admin User',
    companyId: COMPANY_ID,
    role: 'admin',
    createdAt: new Date().toISOString(),
  });

  // Create driver 1
  let driver1;
  try {
    const cred = await createUserWithEmailAndPassword(auth, 'driver1@silvercrown.com', 'password123');
    driver1 = cred.user;
  } catch {
    const cred = await signInWithEmailAndPassword(auth, 'driver1@silvercrown.com', 'password123');
    driver1 = cred.user;
  }

  await setDoc(doc(db, 'users', driver1.uid), {
    email: 'driver1@silvercrown.com',
    displayName: 'John Driver',
    companyId: COMPANY_ID,
    role: 'driver',
    equipmentTypes: ['Dry Van', 'Reefer'],
    createdAt: new Date().toISOString(),
  });

  // Create driver 2
  let driver2;
  try {
    const cred = await createUserWithEmailAndPassword(auth, 'driver2@silvercrown.com', 'password123');
    driver2 = cred.user;
  } catch {
    const cred = await signInWithEmailAndPassword(auth, 'driver2@silvercrown.com', 'password123');
    driver2 = cred.user;
  }

  await setDoc(doc(db, 'users', driver2.uid), {
    email: 'driver2@silvercrown.com',
    displayName: 'Jane Driver',
    companyId: COMPANY_ID,
    role: 'driver',
    equipmentTypes: ['Flatbed'],
    createdAt: new Date().toISOString(),
  });

  const loads = [
    {
      companyId: COMPANY_ID,
      assignedDriverId: driver1.uid,
      assignedDriverName: 'John Driver',
      origin: '233 S Wacker Dr, Chicago, IL 60606, United States',
      destination: '1500 Marilla St, Dallas, TX 75201, United States',
      payout: '2,400',
      miles: '920',
      deadhead: '45',
      type: 'Dry Van',
      status: 'available',
      originCoords: { latitude: 41.8789, longitude: -87.6359 },
      destCoords: { latitude: 32.7767, longitude: -96.797 },
      stops: [
        {
          type: 'pickup',
          address: '233 S Wacker Dr, Chicago, IL 60606, United States',
          coords: { latitude: 41.8789, longitude: -87.6359 },
          sequence: 0,
        },
        {
          type: 'dropoff',
          address: '1500 Marilla St, Dallas, TX 75201, United States',
          coords: { latitude: 32.7767, longitude: -96.797 },
          sequence: 0,
        },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      companyId: COMPANY_ID,
      assignedDriverId: driver1.uid,
      assignedDriverName: 'John Driver',
      origin: '265 Peachtree Center Ave NE, Atlanta, GA 30303, United States',
      destination: '3500 Pan American Dr, Miami, FL 33133, United States',
      payout: '1,850',
      miles: '660',
      deadhead: '12',
      type: 'Reefer',
      status: 'available',
      originCoords: { latitude: 33.759, longitude: -84.387 },
      destCoords: { latitude: 25.728, longitude: -80.234 },
      stops: [
        {
          type: 'pickup',
          address: '265 Peachtree Center Ave NE, Atlanta, GA 30303, United States',
          coords: { latitude: 33.759, longitude: -84.387 },
          sequence: 0,
        },
        {
          type: 'dropoff',
          address: '3500 Pan American Dr, Miami, FL 33133, United States',
          coords: { latitude: 25.728, longitude: -80.234 },
          sequence: 0,
        },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      companyId: COMPANY_ID,
      assignedDriverId: driver2.uid,
      assignedDriverName: 'Jane Driver',
      origin: '400 Broad St, Seattle, WA 98109, United States',
      destination: '200 N Spring St, Los Angeles, CA 90012, United States',
      payout: '3,100',
      miles: '1135',
      deadhead: '80',
      type: 'Flatbed',
      status: 'available',
      originCoords: { latitude: 47.6205, longitude: -122.3493 },
      destCoords: { latitude: 34.0537, longitude: -118.2428 },
      stops: [
        {
          type: 'pickup',
          address: '400 Broad St, Seattle, WA 98109, United States',
          coords: { latitude: 47.6205, longitude: -122.3493 },
          sequence: 0,
        },
        {
          type: 'pickup',
          address: '1000 5th Ave, Seattle, WA 98164, United States',
          coords: { latitude: 47.6062, longitude: -122.3321 },
          sequence: 1,
        },
        {
          type: 'dropoff',
          address: '200 N Spring St, Los Angeles, CA 90012, United States',
          coords: { latitude: 34.0537, longitude: -118.2428 },
          sequence: 0,
        },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      companyId: COMPANY_ID,
      assignedDriverId: driver1.uid,
      assignedDriverName: 'John Driver',
      origin: 'Denver, CO',
      destination: 'Phoenix, AZ',
      payout: '1,950',
      miles: '860',
      type: 'Dry Van',
      status: 'delivered',
      deliveryDate: 'Oct 20, 2023',
      originCoords: { latitude: 39.7392, longitude: -104.9903 },
      destCoords: { latitude: 33.4484, longitude: -112.0740 },
      stops: [
        {
          type: 'pickup',
          address: 'Denver, CO',
          coords: { latitude: 39.7392, longitude: -104.9903 },
          sequence: 0,
        },
        {
          type: 'dropoff',
          address: 'Phoenix, AZ',
          coords: { latitude: 33.4484, longitude: -112.0740 },
          sequence: 0,
        },
      ],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const load of loads) {
    await addDoc(collection(db, 'loads'), load);
  }

  await addDoc(collection(db, 'inspections'), {
    companyId: COMPANY_ID,
    driverId: driver1.uid,
    driverName: 'John Driver',
    truckNumber: 'TRK-2041',
    trailerNumber: 'TRL-992',
    status: 'PASS',
    sections: [
      {
        id: 'engine',
        title: 'Engine Compartment',
        type: 'Truck',
        items: [
          { name: 'Oil Level', status: 'pass' },
          { name: 'Coolant Level', status: 'pass' },
          { name: 'Belts & Hoses', status: 'pass' },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  });

  console.log('Seed complete!');
  console.log('Admin: admin@silvercrown.com / password123');
  console.log('Driver 1: driver1@silvercrown.com / password123');
  console.log('Driver 2: driver2@silvercrown.com / password123');
  console.log('Invite codes: ADMIN001 (admin), DRIVER01 (driver)');
}

seed().catch(console.error);
