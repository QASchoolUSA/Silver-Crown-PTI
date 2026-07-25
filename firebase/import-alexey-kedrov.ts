/**
 * Import Alexey Kedrov driver account, 51 historical loads, payroll summary,
 * and rate confirmation PDFs into production Firebase.
 *
 * Env (.env):
 *   EXPO_PUBLIC_FIREBASE_PROJECT_ID
 *   ALEXEY_EMAIL=alex@kedrov.com
 *   ALEXEY_PASSWORD
 *   SPRINTERSTATE_DATA_DIR=/path/to/downloads/Alexey Kedrov - 797
 *
 * Run: pnpm import:alexey
 * Dry run (no Firebase): pnpm import:alexey -- --validate
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { initializeApp as initClientApp } from 'firebase/app';
import {
  getAuth as getClientAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initAdminApp, ADMIN_CREDENTIALS_HELP, hasServiceAccountCredential } from './admin-credentials';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const useEmulators =
  process.env.USE_FIREBASE_EMULATORS === 'true' ||
  process.env.FIRESTORE_EMULATOR_HOST != null;

if (useEmulators) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
  process.env.GCLOUD_PROJECT ||= 'silver-crown-app';
}

const projectId =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  'silver-crown-app';

const ALEXEY_EMAIL = process.env.ALEXEY_EMAIL || 'alex@kedrov.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@silvercrown.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

function getAlexeyPassword(): string {
  if (process.env.ALEXEY_PASSWORD) return process.env.ALEXEY_PASSWORD;
  if (useEmulators) return 'ChangeMeAlexey2026!';
  throw new Error('Set ALEXEY_PASSWORD in .env before running production import');
}

const DEFAULT_DATA_DIR =
  '/Users/kedrovnick/sprinterstate-downloader/downloads/Alexey Kedrov - 797';
const DATA_DIR = process.env.SPRINTERSTATE_DATA_DIR || DEFAULT_DATA_DIR;
const CSV_PATH = path.join(DATA_DIR, 'gross-pay-summary.csv');
const DOC_DIR = path.join(DATA_DIR, 'document');
const EXPORT_SCRIPT = path.resolve(
  __dirname,
  '../../sprinterstate-downloader/scripts/export_pdf_record.py'
);

const COMPANY_ID = 'silver-crown-global';
const DRIVER_NAME = 'Alexey Kedrov';
const EQUIPMENT: 'Dry Van' = 'Dry Van';

const PAYROLL = {
  totalGrossPay: 212_535,
  dispatchSharePct: 33,
  dispatchShare: 70_136.55,
  truckingExpenses: 8_047.52,
  paidToDate: 53_600,
  balanceDue: 24_584.07,
  loadCount: 51,
};

type CsvRow = {
  dispatchDate: string;
  loadRef: string;
  broker: string;
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  lineHaul: string;
  accessorials: string;
  accessorialDetail: string;
  grossPay: string;
  miles: string;
  sourceFile: string;
  importNotes: string;
};

type PdfRecord = {
  origin?: string | null;
  destination?: string | null;
  pickup_date?: string | null;
  delivery_date?: string | null;
  line_haul?: number | null;
  accessorials?: number | null;
  accessorial_detail?: string;
  gross_pay?: number | null;
  miles?: number | null;
  notes?: string;
};

type Coords = { latitude: number; longitude: number };

const bucketName =
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  process.env.VITE_FIREBASE_STORAGE_BUCKET ||
  `${projectId}.firebasestorage.app`;

let auth: admin.auth.Auth;
let db: admin.firestore.Firestore;
let bucket: ReturnType<admin.storage.Storage['bucket']>;

function initFirebase() {
  if (admin.apps.length) return;
  if (useEmulators) {
    admin.initializeApp({ projectId, storageBucket: bucketName });
  } else {
    initAdminApp(projectId);
  }
  auth = admin.auth();
  db = admin.firestore();
  bucket = admin.storage().bucket(bucketName);
}

const geocodeCache = new Map<string, Coords>();

function stripMoney(value: string): string {
  return value.replace(/[$,\s]/g, '').trim();
}

function formatMoneyDisplay(value: string): string {
  const num = parseFloat(stripMoney(value));
  if (Number.isNaN(num)) return value.replace(/^\$/, '').trim();
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function slugLoadRef(loadRef: string): string {
  return loadRef.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80);
}

function loadDocId(loadRef: string): string {
  return `alexey-${slugLoadRef(loadRef)}`;
}

function documentDocId(loadRef: string, fileName: string): string {
  const base = slugLoadRef(loadRef);
  const fileSlug = fileName.replace(/[^a-zA-Z0-9.]+/g, '-').toLowerCase().slice(0, 40);
  return `alexey-doc-${base}-${fileSlug}`;
}

function parseCsvRows(csvPath: string): CsvRow[] {
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const col = (name: string) => headers.indexOf(name);

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('TOTAL GROSS PAY')) break;

    const cols = parseCsvLine(line);
    const loadRef = cols[col('Load ID')]?.trim();
    if (!loadRef) continue;

    rows.push({
      dispatchDate: cols[col('Dispatch Date')]?.trim() || '',
      loadRef,
      broker: cols[col('Broker')]?.trim() || '',
      origin: cols[col('Origin')]?.trim() || '',
      destination: cols[col('Destination')]?.trim() || '',
      pickupDate: cols[col('Pickup Date')]?.trim() || '',
      deliveryDate: cols[col('Delivery Date')]?.trim() || '',
      lineHaul: cols[col('Line Haul')]?.trim() || '',
      accessorials: cols[col('Accessorials')]?.trim() || '',
      accessorialDetail: cols[col('Accessorial Detail')]?.trim() || '',
      grossPay: cols[col('Gross Pay')]?.trim() || '',
      miles: cols[col('Miles')]?.trim() || '',
      sourceFile: cols[col('Source File')]?.trim() || '',
      importNotes: cols[col('Notes')]?.trim() || '',
    });
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

function enrichFromPdf(sourceFile: string): PdfRecord | null {
  if (!sourceFile || !fs.existsSync(DOC_DIR)) return null;
  const pdfPath = path.join(DOC_DIR, sourceFile);
  if (!fs.existsSync(pdfPath)) return null;

  try {
    const output = execFileSync(
      'python3',
      [EXPORT_SCRIPT, '--data-dir', DATA_DIR, '--filename', sourceFile],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    return JSON.parse(output.trim()) as PdfRecord;
  } catch (error) {
    console.warn(`  ⚠ PDF parse failed for ${sourceFile}:`, (error as Error).message);
    return null;
  }
}

async function geocode(query: string): Promise<Coords | null> {
  const key = query.toLowerCase().trim();
  if (!key || key.includes('tbd')) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  await new Promise((r) => setTimeout(r, 1100));

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query + ', USA')}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SilverCrownPTI-Import/1.0 (alex@kedrov.com)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    if (!data.length) return null;
    const coords = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    };
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}

function toIsoDate(dateStr: string, fallback?: string): string {
  const raw = (dateStr || fallback || '').trim();
  if (!raw) return new Date().toISOString();

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return new Date(`${raw.slice(0, 10)}T12:00:00.000Z`).toISOString();
  }

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let year = parseInt(slash[3], 10);
    if (year < 100) year += 2000;
    const month = slash[1].padStart(2, '0');
    const day = slash[2].padStart(2, '0');
    return new Date(`${year}-${month}-${day}T12:00:00.000Z`).toISOString();
  }

  return new Date().toISOString();
}

async function buildStops(
  origin: string,
  destination: string,
  loadRef: string
): Promise<{ stops: admin.firestore.DocumentData['stops']; origin: string; destination: string }> {
  const pickupQuery = origin.trim();
  const dropQuery = destination.trim();

  let pickupAddress = pickupQuery;
  let dropAddress = dropQuery;
  let pickupCoords: Coords = { latitude: 0, longitude: 0 };
  let dropCoords: Coords = { latitude: 0, longitude: 0 };

  if (pickupQuery) {
    const coords = await geocode(pickupQuery);
    if (coords) {
      pickupCoords = coords;
      pickupAddress = `${pickupQuery}, United States`;
    } else {
      pickupAddress = pickupQuery;
    }
  } else {
    pickupAddress = `Pickup TBD — ${loadRef}`;
  }

  if (dropQuery) {
    const coords = await geocode(dropQuery);
    if (coords) {
      dropCoords = coords;
      dropAddress = `${dropQuery}, United States`;
    } else {
      dropAddress = dropQuery;
    }
  } else {
    dropAddress = `Delivery TBD — ${loadRef}`;
  }

  return {
    origin: pickupAddress,
    destination: dropAddress,
    stops: [
      {
        type: 'pickup',
        address: pickupAddress,
        coords: pickupCoords,
        sequence: 0,
      },
      {
        type: 'dropoff',
        address: dropAddress,
        coords: dropCoords,
        sequence: 0,
      },
    ],
  };
}

async function ensureAuthUser() {
  const password = getAlexeyPassword();
  try {
    const existing = await auth.getUserByEmail(ALEXEY_EMAIL);
    await auth.updateUser(existing.uid, {
      password,
      displayName: DRIVER_NAME,
    });
    return existing.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'auth/user-not-found') throw error;
    const created = await auth.createUser({
      email: ALEXEY_EMAIL,
      password,
      displayName: DRIVER_NAME,
    });
    return created.uid;
  }
}

async function uploadRateConfirmation(
  loadId: string,
  loadRef: string,
  sourceFile: string,
  uploadedBy: string
): Promise<void> {
  const localPath = path.join(DOC_DIR, sourceFile);
  if (!fs.existsSync(localPath)) {
    console.warn(`  ⚠ PDF not found: ${sourceFile}`);
    return;
  }

  const storagePath = `companies/${COMPANY_ID}/documents/${slugLoadRef(loadRef)}/${sourceFile}`;
  const token = bucket.file(storagePath);
  await token.save(fs.readFileSync(localPath), {
    metadata: { contentType: 'application/pdf' },
  });

  let fileUrl: string;
  if (useEmulators) {
    fileUrl = `http://127.0.0.1:9199/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
  } else {
    [fileUrl] = await token.getSignedUrl({
      action: 'read',
      expires: '03-01-2500',
    });
  }

  const docId = documentDocId(loadRef, sourceFile);
  await db.collection('documents').doc(docId).set(
    {
      companyId: COMPANY_ID,
      uploadedBy,
      uploaderName: 'Import Script',
      fileName: sourceFile,
      fileUrl,
      fileType: 'application/pdf',
      docType: 'rate_confirmation',
      status: 'processed',
      loadId,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function validateImportData() {
  console.log('Validating import data (no Firebase writes)...');
  console.log(`Data directory: ${DATA_DIR}`);

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }

  const rows = parseCsvRows(CSV_PATH);
  console.log(`  ✓ CSV rows: ${rows.length}`);

  let enriched = 0;
  let withLanes = 0;
  for (const row of rows) {
    if (row.origin && row.destination) withLanes++;
    else if (row.sourceFile) {
      const pdf = enrichFromPdf(row.sourceFile);
      if (pdf?.origin || pdf?.destination) enriched++;
    }
  }
  console.log(`  ✓ Loads with lanes in CSV: ${withLanes}`);
  console.log(`  ✓ Additional lanes from PDF re-parse: ${enriched}`);

  const pdfCount = fs.existsSync(DOC_DIR)
    ? fs.readdirSync(DOC_DIR).filter((f) => f.toLowerCase().endsWith('.pdf')).length
    : 0;
  console.log(`  ✓ Rate confirmation PDFs in document/: ${pdfCount}`);
  console.log(`  ✓ Payroll gross: $${PAYROLL.totalGrossPay.toLocaleString()}`);
  console.log(`  ✓ Balance due: $${PAYROLL.balanceDue.toLocaleString()}`);
}

function getClientFirebaseConfig() {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: bucketName,
    messagingSenderId:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
  };
}

async function signInAdminClient(auth: ReturnType<typeof getClientAuth>) {
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch (error) {
    const code = (error as { code?: string }).code;
    throw new Error(
      `Admin sign-in failed for ${ADMIN_EMAIL} (${code || 'unknown'}). ` +
        'Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to your production admin account.'
    );
  }
}

async function ensureAlexeyAuthUser(clientApp: ReturnType<typeof initClientApp>, alexeyPassword: string) {
  const auth = getClientAuth(clientApp);
  await signOut(auth).catch(() => {});

  try {
    await signInWithEmailAndPassword(auth, ALEXEY_EMAIL, alexeyPassword);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        await createUserWithEmailAndPassword(auth, ALEXEY_EMAIL, alexeyPassword);
      } catch (createError) {
        const createCode = (createError as { code?: string }).code;
        if (createCode === 'auth/email-already-in-use') {
          throw new Error(
            `${ALEXEY_EMAIL} exists but password did not match. Update ALEXEY_PASSWORD in .env.`
          );
        }
        throw createError;
      }
    } else {
      throw error;
    }
  }

  const uid = auth.currentUser!.uid;
  await auth.currentUser!.getIdToken(true);
  await signOut(auth);
  return uid;
}

async function uploadRateConfirmationClient(
  clientApp: ReturnType<typeof initClientApp>,
  loadId: string,
  loadRef: string,
  sourceFile: string,
  uploadedBy: string
) {
  const localPath = path.join(DOC_DIR, sourceFile);
  if (!fs.existsSync(localPath)) {
    console.warn(`  ⚠ PDF not found: ${sourceFile}`);
    return;
  }

  const storagePath = `companies/${COMPANY_ID}/documents/${slugLoadRef(loadRef)}/${sourceFile}`;
  const storage = getStorage(clientApp);
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, fs.readFileSync(localPath), { contentType: 'application/pdf' });
  const fileUrl = await getDownloadURL(storageRef);

  const db = getFirestore(clientApp);
  const docId = documentDocId(loadRef, sourceFile);
  await setDoc(
    doc(db, 'documents', docId),
    {
      companyId: COMPANY_ID,
      uploadedBy,
      uploaderName: 'Import Script',
      fileName: sourceFile,
      fileUrl,
      fileType: 'application/pdf',
      docType: 'rate_confirmation',
      status: 'processed',
      loadId,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

function formatMiles(value: string | number | null | undefined): string {
  if (value == null || value === '') return '0';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,]/g, ''));
  if (Number.isNaN(num) || num <= 0) return '0';
  return String(Math.round(num));
}

function haversineMiles(a: Coords, b: Coords): number {
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(h)));
}

function resolveMiles(
  csvMiles: string,
  pdfMiles: number | null | undefined,
  pickupCoords: Coords,
  dropCoords: Coords
): string {
  if (csvMiles.trim()) return formatMiles(csvMiles);
  if (pdfMiles != null && pdfMiles > 0) return formatMiles(pdfMiles);
  if (pickupCoords.latitude !== 0 && dropCoords.latitude !== 0) {
    return formatMiles(haversineMiles(pickupCoords, dropCoords));
  }
  return '0';
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

async function importAlexeyViaClient() {
  console.log(`Importing Alexey Kedrov via client SDK (project: ${projectId})`);
  console.log(`Data directory: ${DATA_DIR}`);

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }

  const clientApp = initClientApp(getClientFirebaseConfig());
  const auth = getClientAuth(clientApp);
  const db = getFirestore(clientApp);
  const alexeyPassword = getAlexeyPassword();

  await signInAdminClient(auth);
  console.log(`  ✓ Signed in as admin (${ADMIN_EMAIL})`);

  const alexeyUid = await ensureAlexeyAuthUser(clientApp, alexeyPassword);
  console.log(`  ✓ Driver auth ${ALEXEY_EMAIL} (${alexeyUid})`);

  await signInAdminClient(auth);

  const userRef = doc(db, 'users', alexeyUid);
  const existingProfile = await getDoc(userRef);
  const payrollPayload = {
    equipmentTypes: [EQUIPMENT],
    payrollSummary: {
      ...PAYROLL,
      updatedAt: new Date().toISOString(),
    },
  };

  if (existingProfile.exists()) {
    await updateDoc(userRef, payrollPayload);
  } else {
    await setDoc(userRef, {
      email: ALEXEY_EMAIL,
      displayName: DRIVER_NAME,
      companyId: COMPANY_ID,
      role: 'driver',
      createdAt: new Date().toISOString(),
      ...payrollPayload,
    });
  }
  console.log('  ✓ Driver profile + payroll summary');

  const rows = parseCsvRows(CSV_PATH);
  console.log(`  Importing ${rows.length} loads...`);

  let imported = 0;
  for (const row of rows) {
    let origin = row.origin;
    let destination = row.destination;
    let pickupDate = row.pickupDate;
    let deliveryDate = row.deliveryDate;
    let lineHaul = row.lineHaul;
    let accessorials = row.accessorials;
    let accessorialDetail = row.accessorialDetail;
    let importNotes = row.importNotes;
    let pdfMiles: number | null | undefined = null;

    if (row.sourceFile && (!origin || !destination || !row.miles)) {
      const pdf = enrichFromPdf(row.sourceFile);
      if (pdf) {
        origin = origin || pdf.origin || '';
        destination = destination || pdf.destination || '';
        pickupDate = pickupDate || pdf.pickup_date || '';
        deliveryDate = deliveryDate || pdf.delivery_date || '';
        pdfMiles = pdf.miles;
        if (!lineHaul && pdf.line_haul != null) lineHaul = `$${pdf.line_haul.toFixed(2)}`;
        if (!accessorials && pdf.accessorials != null) accessorials = `$${pdf.accessorials.toFixed(2)}`;
        if (!accessorialDetail && pdf.accessorial_detail) accessorialDetail = pdf.accessorial_detail;
        if (!importNotes && pdf.notes) importNotes = pdf.notes;
      }
    }

    const { stops, origin: pickupAddress, destination: dropAddress } = await buildStops(
      origin,
      destination,
      row.loadRef
    );

    const docId = loadDocId(row.loadRef);
    const deliveryIso = toIsoDate(deliveryDate, row.dispatchDate);
    const createdIso = toIsoDate(row.dispatchDate);
    const miles = resolveMiles(row.miles, pdfMiles, stops[0].coords, stops[1].coords);

    await setDoc(
      doc(db, 'loads', docId),
      omitUndefined({
        companyId: COMPANY_ID,
        assignedDriverId: alexeyUid,
        assignedDriverName: DRIVER_NAME,
        stops,
        origin: pickupAddress,
        destination: dropAddress,
        originCoords: stops[0].coords,
        destCoords: stops[1].coords,
        payout: formatMoneyDisplay(row.grossPay),
        miles,
        deadhead: '0',
        type: EQUIPMENT,
        status: 'delivered',
        deliveryDate: deliveryIso,
        createdAt: createdIso,
        loadRef: row.loadRef,
        broker: row.broker,
        dispatchDate: row.dispatchDate,
        pickupDate: pickupDate || undefined,
        lineHaul: lineHaul ? formatMoneyDisplay(lineHaul) : undefined,
        accessorials: accessorials ? formatMoneyDisplay(accessorials) : undefined,
        accessorialDetail: accessorialDetail || undefined,
        importNotes: importNotes || undefined,
        sourceFile: row.sourceFile || undefined,
      }),
      { merge: true }
    );

    if (row.sourceFile && !process.argv.includes('--skip-documents')) {
      await uploadRateConfirmationClient(clientApp, docId, row.loadRef, row.sourceFile, alexeyUid);
    }

    imported++;
    console.log(`  ✓ Load ${row.loadRef} (${imported}/${rows.length})`);
  }

  console.log(`\nImport complete! ${imported} loads for ${ALEXEY_EMAIL}`);
  console.log(`Gross pay: $${PAYROLL.totalGrossPay.toLocaleString()} · Balance due: $${PAYROLL.balanceDue.toLocaleString()}`);
}

async function importAlexey() {
  initFirebase();
  console.log(`Importing Alexey Kedrov into project: ${projectId}${useEmulators ? ' (emulators)' : ''}`);
  console.log(`Data directory: ${DATA_DIR}`);

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }

  try {
    if (!useEmulators) {
      await auth.listUsers(1);
    }
  } catch (error) {
    const message = (error as Error).message || String(error);
    if (message.includes('credential') || message.includes('Could not load')) {
      throw new Error(ADMIN_CREDENTIALS_HELP);
    }
    throw error;
  }

  const uid = await ensureAuthUser();
  console.log(`  ✓ Auth user ${ALEXEY_EMAIL} (${uid})`);

  await db.collection('users').doc(uid).set(
    {
      email: ALEXEY_EMAIL,
      displayName: DRIVER_NAME,
      companyId: COMPANY_ID,
      role: 'driver',
      equipmentTypes: [EQUIPMENT],
      payrollSummary: {
        ...PAYROLL,
        updatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log('  ✓ Payroll summary on user profile');

  const rows = parseCsvRows(CSV_PATH);
  console.log(`  Importing ${rows.length} loads...`);

  let imported = 0;
  for (const row of rows) {
    let origin = row.origin;
    let destination = row.destination;
    let pickupDate = row.pickupDate;
    let deliveryDate = row.deliveryDate;
    let lineHaul = row.lineHaul;
    let accessorials = row.accessorials;
    let accessorialDetail = row.accessorialDetail;
    let importNotes = row.importNotes;
    let pdfMiles: number | null | undefined = null;

    if (row.sourceFile && (!origin || !destination || !row.miles)) {
      const pdf = enrichFromPdf(row.sourceFile);
      if (pdf) {
        origin = origin || pdf.origin || '';
        destination = destination || pdf.destination || '';
        pickupDate = pickupDate || pdf.pickup_date || '';
        deliveryDate = deliveryDate || pdf.delivery_date || '';
        pdfMiles = pdf.miles;
        if (!lineHaul && pdf.line_haul != null) lineHaul = `$${pdf.line_haul.toFixed(2)}`;
        if (!accessorials && pdf.accessorials != null) accessorials = `$${pdf.accessorials.toFixed(2)}`;
        if (!accessorialDetail && pdf.accessorial_detail) accessorialDetail = pdf.accessorial_detail;
        if (!importNotes && pdf.notes) importNotes = pdf.notes;
      }
    }

    const { stops, origin: pickupAddress, destination: dropAddress } = await buildStops(
      origin,
      destination,
      row.loadRef
    );

    const docId = loadDocId(row.loadRef);
    const deliveryIso = toIsoDate(deliveryDate, row.dispatchDate);
    const createdIso = toIsoDate(row.dispatchDate);
    const miles = resolveMiles(row.miles, pdfMiles, stops[0].coords, stops[1].coords);

    const loadData = {
      companyId: COMPANY_ID,
      assignedDriverId: uid,
      assignedDriverName: DRIVER_NAME,
      stops,
      origin: pickupAddress,
      destination: dropAddress,
      originCoords: stops[0].coords,
      destCoords: stops[1].coords,
      payout: formatMoneyDisplay(row.grossPay),
      miles,
      deadhead: '0',
      type: EQUIPMENT,
      status: 'delivered',
      deliveryDate: deliveryIso,
      createdAt: createdIso,
      loadRef: row.loadRef,
      broker: row.broker,
      dispatchDate: row.dispatchDate,
      pickupDate: pickupDate || undefined,
      lineHaul: lineHaul ? formatMoneyDisplay(lineHaul) : undefined,
      accessorials: accessorials ? formatMoneyDisplay(accessorials) : undefined,
      accessorialDetail: accessorialDetail || undefined,
      importNotes: importNotes || undefined,
      sourceFile: row.sourceFile || undefined,
    };

    await db.collection('loads').doc(docId).set(loadData, { merge: true });

    if (row.sourceFile && !process.argv.includes('--skip-documents')) {
      await uploadRateConfirmation(docId, row.loadRef, row.sourceFile, uid);
    }

    imported++;
    console.log(`  ✓ Load ${row.loadRef} (${imported}/${rows.length})`);
  }

  console.log(`\nImport complete! ${imported} loads for ${ALEXEY_EMAIL}`);
  console.log(`Gross pay: $${PAYROLL.totalGrossPay.toLocaleString()} · Balance due: $${PAYROLL.balanceDue.toLocaleString()}`);
}

async function main() {
  if (process.argv.includes('--validate')) {
    await validateImportData();
    return;
  }

  if (!useEmulators && !hasServiceAccountCredential()) {
    console.log('No firebase/service-account.json — falling back to client SDK import.');
    await importAlexeyViaClient();
    return;
  }

  try {
    await importAlexey();
  } catch (error) {
    const message = (error as Error).message || String(error);
    if (message.includes('credentials') || message.includes('Could not load')) {
      console.log('Admin SDK unavailable — falling back to client SDK import.');
      await importAlexeyViaClient();
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
