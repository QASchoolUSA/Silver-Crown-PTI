/**
 * Firestore security rules tests.
 * Run with: pnpm emulators:exec "npx jest packages/shared/src/__tests__/firestore.rules.test.ts"
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, addDoc, updateDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'silver-crown-pti-test';
const COMPANY_ID = 'test-company';
const DRIVER1_ID = 'driver1';
const DRIVER2_ID = 'driver2';
const ADMIN_ID = 'admin1';

beforeAll(async () => {
  const rulesPath = path.resolve(__dirname, '../../../../firebase/firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', DRIVER1_ID), {
      email: 'd1@test.com', displayName: 'Driver 1', companyId: COMPANY_ID, role: 'driver', createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'users', DRIVER2_ID), {
      email: 'd2@test.com', displayName: 'Driver 2', companyId: COMPANY_ID, role: 'driver', createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'users', ADMIN_ID), {
      email: 'admin@test.com', displayName: 'Admin', companyId: COMPANY_ID, role: 'admin', createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'loads', 'load1'), {
      companyId: COMPANY_ID, assignedDriverId: DRIVER1_ID, origin: 'A', destination: 'B',
      payout: '100', miles: '50', type: 'Dry Van', status: 'available', createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'inspections', 'insp1'), {
      companyId: COMPANY_ID, driverId: DRIVER1_ID, driverName: 'Driver 1',
      truckNumber: 'TRK-1', trailerNumber: null, status: 'PASS', sections: [], createdAt: new Date().toISOString(),
    });
  });
});

describe('Firestore Security Rules', () => {
  it('driver can read their assigned load', async () => {
    const db = testEnv.authenticatedContext(DRIVER1_ID).firestore();
    await assertSucceeds(getDoc(doc(db, 'loads', 'load1')));
  });

  it('driver cannot read load assigned to another driver', async () => {
    const db = testEnv.authenticatedContext(DRIVER2_ID).firestore();
    await assertFails(getDoc(doc(db, 'loads', 'load1')));
  });

  it('admin can read all company loads', async () => {
    const db = testEnv.authenticatedContext(ADMIN_ID).firestore();
    await assertSucceeds(getDoc(doc(db, 'loads', 'load1')));
  });

  it('driver can read their own inspection', async () => {
    const db = testEnv.authenticatedContext(DRIVER1_ID).firestore();
    await assertSucceeds(getDoc(doc(db, 'inspections', 'insp1')));
  });

  it('driver cannot read another driver inspection', async () => {
    const db = testEnv.authenticatedContext(DRIVER2_ID).firestore();
    await assertFails(getDoc(doc(db, 'inspections', 'insp1')));
  });

  it('admin can create loads', async () => {
    const db = testEnv.authenticatedContext(ADMIN_ID).firestore();
    await assertSucceeds(addDoc(collection(db, 'loads'), {
      companyId: COMPANY_ID, assignedDriverId: DRIVER1_ID, origin: 'X', destination: 'Y',
      payout: '200', miles: '100', type: 'Reefer', status: 'available', createdAt: new Date().toISOString(),
    }));
  });

  it('driver cannot create loads', async () => {
    const db = testEnv.authenticatedContext(DRIVER1_ID).firestore();
    await assertFails(addDoc(collection(db, 'loads'), {
      companyId: COMPANY_ID, assignedDriverId: DRIVER1_ID, origin: 'X', destination: 'Y',
      payout: '200', miles: '100', type: 'Reefer', status: 'available', createdAt: new Date().toISOString(),
    }));
  });

  it('admin can update driver equipment', async () => {
    const db = testEnv.authenticatedContext(ADMIN_ID).firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', DRIVER1_ID), {
      equipmentTypes: ['Dry Van', 'Reefer'],
    }));
  });

  it('admin cannot update driver name', async () => {
    const db = testEnv.authenticatedContext(ADMIN_ID).firestore();
    await assertFails(updateDoc(doc(db, 'users', DRIVER1_ID), {
      displayName: 'Hacked Name',
    }));
  });

  it('driver cannot update another driver equipment', async () => {
    const db = testEnv.authenticatedContext(DRIVER1_ID).firestore();
    await assertFails(updateDoc(doc(db, 'users', DRIVER2_ID), {
      equipmentTypes: ['Flatbed'],
    }));
  });
});
