import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

const SERVICE_ACCOUNT_PATHS = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.resolve(__dirname, 'service-account.json'),
].filter((value): value is string => Boolean(value));

function gcloudAccessToken(): string | null {
  try {
    const token = execSync('gcloud auth print-access-token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return token || null;
  } catch {
    return null;
  }
}

function loadServiceAccountCredential() {
  for (const filePath of SERVICE_ACCOUNT_PATHS) {
    if (!existsSync(filePath)) continue;
    const json = JSON.parse(readFileSync(filePath, 'utf8'));
    return admin.credential.cert(json);
  }
  return null;
}

export const ADMIN_CREDENTIALS_HELP = [
  'Firebase Admin credentials are missing or invalid.',
  '',
  'Option 1 (recommended): Service account key',
  '  Firebase Console → Project settings → Service accounts → Generate new private key',
  '  Save the file as firebase/service-account.json',
  '  Run: pnpm seed:production',
  '',
  'Option 2: Google Cloud CLI',
  '  gcloud auth application-default login',
  '  pnpm seed:production',
  '',
  'Note: `firebase login` does not provide Admin SDK credentials.',
].join('\n');

export function initAdminApp(projectId: string) {
  const serviceAccount = loadServiceAccountCredential();
  if (serviceAccount) {
    admin.initializeApp({ credential: serviceAccount, projectId });
    return;
  }

  const gcloudToken = gcloudAccessToken();
  if (gcloudToken) {
    admin.initializeApp({
      projectId,
      credential: {
        getAccessToken: async () => ({
          access_token: gcloudToken,
          expires_in: 3600,
        }),
      },
    });
    return;
  }

  try {
    admin.initializeApp({
      projectId,
      credential: admin.credential.applicationDefault(),
    });
    return;
  } catch {
    // ADC not configured
  }

  throw new Error(ADMIN_CREDENTIALS_HELP);
}
