// Web (panel de Talento Humano en el navegador).
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

import { app, EMULATOR_HOST, EMULATOR_SAME_ORIGIN, FUNCTIONS_REGION } from './firebase-config';

const demo = EMULATOR_SAME_ORIGIN && typeof window !== 'undefined';
const origin = demo ? window.location.origin : '';

export const auth = getAuth(app);
export const db = demo
  ? initializeFirestore(app, { host: window.location.host, ssl: window.location.protocol === 'https:', experimentalForceLongPolling: true })
  : getFirestore(app);
export const functions = demo
  ? getFunctions(app, `${origin}/__fn/${app.options.projectId}/${FUNCTIONS_REGION}`)
  : getFunctions(app, FUNCTIONS_REGION);

if (demo) {
  connectAuthEmulator(auth, origin, { disableWarnings: true });
} else if (EMULATOR_HOST) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
}
