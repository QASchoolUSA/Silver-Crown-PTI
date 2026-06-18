import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReactNativePersistence } from 'firebase/auth';
import { initFirebase, getFirebaseConfigFromEnv } from '@silver-crown/shared';

const extra = Constants.expoConfig?.extra ?? {};

const env = {
  EXPO_PUBLIC_FIREBASE_API_KEY: extra.firebaseApiKey,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: extra.firebaseAuthDomain,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: extra.firebaseProjectId,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: extra.firebaseStorageBucket,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: extra.firebaseMessagingSenderId,
  EXPO_PUBLIC_FIREBASE_APP_ID: extra.firebaseAppId,
  USE_FIREBASE_EMULATORS: extra.useFirebaseEmulators ? 'true' : 'false',
};

initFirebase(getFirebaseConfigFromEnv(env), {
  authPersistence: getReactNativePersistence(AsyncStorage),
});
