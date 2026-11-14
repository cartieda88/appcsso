/**
 * Envío de notificaciones push con el servicio de Expo (sirve para Android e iOS
 * sin configurar FCM/APNs a mano: EAS gestiona las credenciales).
 * En el emulador no se envía nada: se guarda en la colección pushLog para pruebas.
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
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
/** Dirección pública de la versión web (para abrir la pantalla al tocar un Web Push). */
const WEB_URL = process.env.WEB_URL ?? `https://${process.env.GCLOUD_PROJECT ?? 'demo-muevete'}.web.app`;

type Target = { token: string; kind: 'expo' | 'web'; ref: FirebaseFirestore.DocumentReference };
const toTarget = (d: FirebaseFirestore.QueryDocumentSnapshot): Target => ({
  token: d.get('token') as string, kind: d.get('kind') === 'web' ? 'web' : 'expo', ref: d.ref,
});

/** Dispositivos de esos usuarios (o de todos si uids es "all"): teléfonos con la app y navegadores. */
export async function tokensFor(uids: string[] | 'all', only?: 'expo' | 'web'): Promise<Target[]> {
  const db = getFirestore();
  let out: Target[] = [];
  if (uids === 'all') {
    out = (await db.collectionGroup('devices').get()).docs.map(toTarget);
  } else {
    for (let i = 0; i < uids.length; i += 30) {
      const snaps = await Promise.all(uids.slice(i, i + 30).map((u) => db.collection(`users/${u}/devices`).get()));
      snaps.forEach((s) => s.docs.forEach((d) => out.push(toTarget(d))));
    }
  }
  return out.filter((t) => typeof t.token === 'string' && (!only || t.kind === only));
}

/** Web Push con Firebase Cloud Messaging (navegadores y PWA instalada). */
async function sendWeb(targets: Target[], msg: PushMessage): Promise<number> {
  let sent = 0;
  for (let i = 0; i < targets.length; i += 500) {
    const chunk = targets.slice(i, i + 500);
    const res = await getMessaging().sendEachForMulticast({
      tokens: chunk.map((t) => t.token),
      webpush: {
        notification: { title: msg.title, body: msg.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
        fcmOptions: { link: new URL(msg.url ?? '/', WEB_URL).toString() },
      },
      data: { url: msg.url ?? '/' },
    });
    await Promise.all(res.responses.map(async (r, k) => {
      if (r.success) sent++;
      else if (r.error?.code === 'messaging/registration-token-not-registered') await chunk[k].ref.delete();
    }));
  }
  return sent;
}

export async function sendPush(uids: string[] | 'all', msg: PushMessage, tag: string, only?: 'expo' | 'web'): Promise<number> {
  const db = getFirestore();
  const all = await tokensFor(uids, only);
  const targets = all.filter((t) => t.kind === 'expo' && t.token.startsWith('ExponentPushToken'));
  const webTargets = all.filter((t) => t.kind === 'web');
  if (IS_EMULATOR) {
    await db.collection('pushLog').add({ tag, ...msg, recipients: uids === 'all' ? 'all' : uids, tokens: targets.length, webTokens: webTargets.length, at: FieldValue.serverTimestamp() });
    logger.info(`[emulador] push "${msg.title}" → ${targets.length} teléfonos, ${webTargets.length} navegadores (${tag})`);
    return targets.length + webTargets.length;
  }
  let sent = webTargets.length ? await sendWeb(webTargets, msg).catch((e) => { logger.error('Web Push falló', e); return 0; }) : 0;
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
  logger.info(`push "${msg.title}" → ${sent}/${targets.length + webTargets.length} (${tag})`);
  return sent;
}
