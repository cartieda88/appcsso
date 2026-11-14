import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

/** Valores de la app web registrada en la consola de Firebase (ver app/.env.example). */
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-muevete',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const FUNCTIONS_REGION = 'us-east1';
/** IP de tu computadora en la red local cuando pruebas con los emuladores desde un teléfono. */
export const EMULATOR_HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST;

/** false si el build no trae la configuración de Firebase (ver docs/COMPILAR-PILOTO.md). */
export const FIREBASE_CONFIGURED = !!process.env.EXPO_PUBLIC_FIREBASE_API_KEY && !!process.env.EXPO_PUBLIC_FIREBASE_APP_ID;

export const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
