import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import type { FirebaseEnvConfig, FirebaseInitOptions } from '../types';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;
let emulatorsConnected = false;

export function initFirebase(config: FirebaseEnvConfig, options?: FirebaseInitOptions) {
  if (!getApps().length) {
    app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
  } else {
    app = getApps()[0];
  }

  if (options?.authPersistence) {
    try {
      auth = initializeAuth(app, { persistence: options.authPersistence });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/already-initialized') {
        auth = getAuth(app);
      } else {
        throw error;
      }
    }
  } else {
    auth = getAuth(app);
  }
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);

  if (config.useEmulators && !emulatorsConnected) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    emulatorsConnected = true;
  }

  return { app, auth, db, storage, functions };
}

export function getFirebaseAuth() {
  if (!auth) throw new Error('Firebase not initialized. Call initFirebase first.');
  return auth;
}

export function getFirebaseDb() {
  if (!db) throw new Error('Firebase not initialized. Call initFirebase first.');
  return db;
}

export function getFirebaseStorage() {
  if (!storage) throw new Error('Firebase not initialized. Call initFirebase first.');
  return storage;
}

export function getFirebaseFunctions() {
  if (!functions) throw new Error('Firebase not initialized. Call initFirebase first.');
  return functions;
}

export function getFirebaseConfigFromEnv(env: Record<string, string | undefined>): FirebaseEnvConfig {
  const prefix = env.EXPO_PUBLIC_FIREBASE_API_KEY ? 'EXPO_PUBLIC_' : 'VITE_';
  const useEmulators =
    env.USE_FIREBASE_EMULATORS === 'true' || env.VITE_USE_FIREBASE_EMULATORS === 'true';

  return {
    apiKey: env[`${prefix}FIREBASE_API_KEY`] ?? '',
    authDomain: env[`${prefix}FIREBASE_AUTH_DOMAIN`] ?? '',
    projectId: env[`${prefix}FIREBASE_PROJECT_ID`] ?? '',
    storageBucket: env[`${prefix}FIREBASE_STORAGE_BUCKET`] ?? '',
    messagingSenderId: env[`${prefix}FIREBASE_MESSAGING_SENDER_ID`] ?? '',
    appId: env[`${prefix}FIREBASE_APP_ID`] ?? '',
    useEmulators,
  };
}
