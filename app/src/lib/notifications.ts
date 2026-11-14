import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDevice, unregisterDevice } from './api';
import { DEFAULT_PAUSE_PREFS, pauseTimes, type PausePrefs } from './pause-schedule';

type Channel = 'eventos' | 'pausas' | 'logros';

/** Llamar una vez al iniciar la app. */
export async function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('eventos', { name: 'Carreras y eventos', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], lightColor: '#F5AD20' });
    await Notifications.setNotificationChannelAsync('pausas', { name: 'Recordatorios de pausas activas', importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.setNotificationChannelAsync('logros', { name: 'Metas y logros', importance: Notifications.AndroidImportance.DEFAULT });
  }
}

export async function ensurePermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const TOKEN_KEY = 'muevete.pushToken';

/**
 * Registra el teléfono para recibir notificaciones push del servidor (eventos).
 * Requiere un build de EAS (projectId) y un teléfono físico.
 */
export async function registerForPush(): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!Device.isDevice) return 'unsupported';
  const projectId = (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
  if (!projectId) return 'unsupported';
  if (!(await ensurePermission())) return 'denied';
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerDevice({ token, platform: Platform.OS });
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
  return 'ok';
}

/** Al cerrar sesión: este teléfono deja de recibir avisos de esa cuenta. */
export async function unregisterPush() {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (token) await unregisterDevice({ token }).catch(() => {});
}

/** Notificación inmediata generada en el teléfono (p. ej. meta de pasos). */
export async function notifyLocal(n: { title: string; body: string; url?: string; channelId?: Channel }) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: n.title, body: n.body, data: { url: n.url ?? '/' }, sound: 'default' },
    trigger: Platform.OS === 'android' ? { channelId: n.channelId ?? 'logros' } : null,
  });
}

/* ---------------- Recordatorios de pausas activas ---------------- */

export { DEFAULT_PAUSE_PREFS, nextPause, pauseTimes, type PausePrefs } from './pause-schedule';
const PREFS_KEY = 'muevete.pausas';
const ID_PREFIX = 'pausa-';

const TIPS = [
  'Levántate, estira el cuello y los hombros. Te toma 2 minutos.',
  'Hora de una pausa activa: mueve muñecas y dedos, y mira lejos de la pantalla.',
  'Tu espalda te lo agradecerá: haz la rutina guiada de 2 minutos.',
  'Pausa activa: camina un poco y estira las piernas. Suma 5 puntos.',
];

export async function loadPausePrefs(): Promise<PausePrefs> {
  try { return { ...DEFAULT_PAUSE_PREFS, ...JSON.parse((await AsyncStorage.getItem(PREFS_KEY)) ?? '{}') }; }
  catch { return DEFAULT_PAUSE_PREFS; }
}

/** Guarda las preferencias y reprograma los recordatorios semanales en el teléfono. */
export async function savePausePrefs(p: PausePrefs): Promise<'ok' | 'denied'> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p)).catch(() => {});
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.identifier.startsWith(ID_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  if (!p.enabled) return 'ok';
  if (!(await ensurePermission())) return 'denied';
  let i = 0;
  for (const weekday of p.weekdays) {
    for (const { h, m } of pauseTimes(p)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${weekday}-${h}-${m}`,
        content: { title: 'Pausa activa', body: TIPS[i++ % TIPS.length], data: { url: '/pausa' }, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: h, minute: m, channelId: 'pausas' },
      });
    }
  }
  return 'ok';
}

/** Ruta a abrir al tocar una notificación (también si la app estaba cerrada). */
export function onNotificationOpen(go: (url: string) => void): () => void {
  Notifications.getLastNotificationResponseAsync().then((r) => {
    const url = r?.notification.request.content.data?.url;
    if (typeof url === 'string') go(url);
  });
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = r.notification.request.content.data?.url;
    if (typeof url === 'string') go(url);
  });
  return () => sub.remove();
}

/** Solo web: en el teléfono no hace falta (los permisos se piden al registrar). */
export const webPushStatus = async (): Promise<'granted' | 'prompt' | 'denied' | 'install-first' | 'unsupported'> => 'unsupported';
export const enableWebPush = async (): Promise<'ok' | 'denied' | 'unsupported'> => 'unsupported';
