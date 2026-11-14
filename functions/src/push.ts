/**
 * Envío de notificaciones push con el servicio de Expo (sirve para Android e iOS
 * sin configurar FCM/APNs a mano: EAS gestiona las credenciales).
 * En el emulador no se envía nada: se guarda en la colección pushLog para pruebas.
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

export interface PushMessage {
  title: string;
  body: string;
  /** Ruta de la app que se abre al tocar la notificación, p. ej. "/retos". */
  url?: string;
  channelId?: 'eventos' | 'logros' | 'pausas';
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

/** Tokens de los dispositivos de esos usuarios (o de todos si uids es "all"). */
export async function tokensFor(uids: string[] | 'all'): Promise<{ token: string; ref: FirebaseFirestore.DocumentReference }[]> {
  const db = getFirestore();
  if (uids === 'all') {
    const snap = await db.collectionGroup('devices').get();
    return snap.docs.map((d) => ({ token: d.get('token') as string, ref: d.ref }));
  }
  const out: { token: string; ref: FirebaseFirestore.DocumentReference }[] = [];
  for (let i = 0; i < uids.length; i += 30) {
    const snaps = await Promise.all(uids.slice(i, i + 30).map((u) => db.collection(`users/${u}/devices`).get()));
    snaps.forEach((s) => s.docs.forEach((d) => out.push({ token: d.get('token'), ref: d.ref })));
  }
  return out;
}

export async function sendPush(uids: string[] | 'all', msg: PushMessage, tag: string): Promise<number> {
  const db = getFirestore();
  const targets = (await tokensFor(uids)).filter((t) => typeof t.token === 'string' && t.token.startsWith('ExponentPushToken'));
  if (IS_EMULATOR) {
    await db.collection('pushLog').add({ tag, ...msg, recipients: uids === 'all' ? 'all' : uids, tokens: targets.length, at: FieldValue.serverTimestamp() });
    logger.info(`[emulador] push "${msg.title}" → ${targets.length} dispositivos (${tag})`);
    return targets.length;
  }
  let sent = 0;
  for (let i = 0; i < targets.length; i += 100) {
    const chunk = targets.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk.map((t) => ({
        to: t.token, title: msg.title, body: msg.body, sound: 'default', priority: 'high',
        channelId: msg.channelId ?? 'eventos', data: { url: msg.url ?? '/' },
      }))),
    });
    if (!res.ok) { logger.error('Expo push falló', res.status, await res.text()); continue; }
    const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    await Promise.all((json.data ?? []).map(async (r, k) => {
      if (r.status === 'ok') sent++;
      else if (r.details?.error === 'DeviceNotRegistered') await chunk[k].ref.delete(); // app desinstalada
    }));
  }
  logger.info(`push "${msg.title}" → ${sent}/${targets.length} (${tag})`);
  return sent;
}
