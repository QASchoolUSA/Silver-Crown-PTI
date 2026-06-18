/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_USE_FIREBASE_EMULATORS: string;
  readonly EXPO_PUBLIC_FIREBASE_API_KEY: string;
  readonly EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly EXPO_PUBLIC_FIREBASE_PROJECT_ID: string;
  readonly EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  readonly EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly EXPO_PUBLIC_FIREBASE_APP_ID: string;
  readonly USE_FIREBASE_EMULATORS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
