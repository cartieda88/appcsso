/**
 * Conexión de los scripts a Firebase.
 * - Emulador: exporta FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (y GCLOUD_PROJECT=demo-muevete).
 * - Producción: exporta GOOGLE_APPLICATION_CREDENTIALS=/ruta/service-account.json
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || undefined });
export const db = getFirestore();
