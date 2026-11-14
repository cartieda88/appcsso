/**
 * Notificaciones en la versión web (navegador o "Agregar a pantalla de inicio").
 * - Eventos y pausas activas llegan por Web Push (Firebase Cloud Messaging) desde el servidor.
 * - En iPhone, Safari solo permite Web Push si la página se instaló en la pantalla de inicio (iOS 16.4+).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

import { registerDevice, savePauseReminders, unregisterDevice } from './api';
import { app } from './firebase-config';
import { DEFAULT_PAUSE_PREFS, type PausePrefs } from './pause-schedule';

export { DEFAULT_PAUSE_PREFS, nextPause, pauseTimes, type PausePrefs } from './pause-schedule';

const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
const TOKEN_KEY = 'muevete.webPushToken';
const PREFS_KEY = 'muevete.pausas';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

async function swRegistration() {
  // El service worker necesita estos datos para atender las notificaciones con la página cerrada.
  const o = app.options;
  const q = new URLSearchParams({ apiKey: o.apiKey ?? '', projectId: o.projectId ?? '', messagingSenderId: o.messagingSenderId ?? '', appId: o.appId ?? '' });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${q}`);
}

export const configureNotifications = async () => {};

/** Estado de las notificaciones en este navegador, para mostrar el botón o la ayuda correcta. */
export async function webPushStatus(): Promise<'granted' | 'prompt' | 'denied' | 'install-first' | 'unsupported'> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  if (isIOS() && !isStandalone()) return 'install-first';
  if (!VAPID_KEY || !('Notification' in window) || !(await isSupported().catch(() => false))) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.permission === 'denied' ? 'denied' : 'prompt';
}

async function subscribe(): Promise<'ok' | 'denied' | 'unsupported'> {
  const reg = await swRegistration();
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) return 'unsupported';
  await registerDevice({ token, kind: 'web', platform: isIOS() ? 'ios-web' : 'web' });
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
  return 'ok';
}

/** Pide permiso y registra el navegador. Debe llamarse desde un toque del usuario (botón). */
export async function enableWebPush(): Promise<'ok' | 'denied' | 'unsupported'> {
  const st = await webPushStatus();
  if (st === 'unsupported' || st === 'install-first') return 'unsupported';
  if (st === 'denied') return 'denied';
  if (st === 'prompt' && (await Notification.requestPermission()) !== 'granted') return 'denied';
  return subscribe();
}

/** Al iniciar sesión: si el permiso ya estaba dado, renueva el registro sin preguntar. */
export async function registerForPush(): Promise<'ok' | 'denied' | 'unsupported'> {
  const st = await webPushStatus();
  if (st !== 'granted') return st === 'denied' ? 'denied' : 'unsupported';
  return subscribe();
}

export async function unregisterPush() {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await unregisterDevice({ token }).catch(() => {});
  if (await isSupported().catch(() => false)) await deleteToken(getMessaging(app)).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

export const ensurePermission = async () => (await webPushStatus()) === 'granted';
export const notifyLocal = async (_n: { title: string; body: string; url?: string; channelId?: string }) => {};

/* ---------- Pausas activas: en web los recordatorios los envía el servidor ---------- */
export async function loadPausePrefs(): Promise<PausePrefs> {
  try { return { ...DEFAULT_PAUSE_PREFS, ...JSON.parse((await AsyncStorage.getItem(PREFS_KEY)) ?? '{}') }; }
  catch { return DEFAULT_PAUSE_PREFS; }
}

export async function savePausePrefs(p: PausePrefs): Promise<'ok' | 'denied'> {
  if (p.enabled) {
    const r = await enableWebPush();
    if (r !== 'ok') return 'denied';
  }
  await savePauseReminders(p);
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p)).catch(() => {});
  return 'ok';
}

/** Con la página abierta, el navegador no muestra el aviso solo: lo mostramos nosotros. */
export function onNotificationOpen(go: (url: string) => void): () => void {
  let unsub = () => {};
  isSupported().then((ok) => {
    if (!ok || Notification.permission !== 'granted') return;
    unsub = onMessage(getMessaging(app), async (m) => {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js').catch(() => undefined);
      const title = m.notification?.title ?? 'Muévete';
      const opts = { body: m.notification?.body, icon: '/icons/icon-192.png', data: { url: m.data?.url ?? '/' } };
      if (reg) await reg.showNotification(title, opts);
      else new Notification(title, opts).onclick = () => go(m.data?.url ?? '/');
    });
  });
  return () => unsub();
}
