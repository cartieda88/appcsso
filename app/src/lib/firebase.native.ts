// Android / iOS: la sesión se guarda en el teléfono para no pedir el código cada vez.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectAuthEmulator, getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

import { app, EMULATOR_HOST, FUNCTIONS_REGION } from './firebase-config';

// getReactNativePersistence solo existe en el build de React Native de @firebase/auth.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('@firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => import('firebase/auth').Persistence;
};

function createAuth(): Auth {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app); // ya inicializado (recarga en caliente)
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);

if (EMULATOR_HOST) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
}
