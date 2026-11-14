import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { defineSecret, defineString } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

import {
  ACTIVITIES,
  advanceChallenge,
  canRegister,
  creditActivity,
  PASSPORT_ACHIEVEMENTS,
  releaseStamp,
  reserveStamp,
  type ActivityId,
  dayKey,
  emptyStats,
  isActivityId,
  monthKey,
  normalizeEmail,
  parseQr,
  weekKey,
  addDays,
  type ChallengeDef,
  type ChallengeProgress,
  type UserStats,
} from './rules';

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: 'us-east1', maxInstances: 10 });

/* ---------- configuración (firebase functions:secrets:set / .env) ---------- */
const ALLOWED_DOMAIN = defineString('ALLOWED_DOMAIN', { default: 'netlife.net.ec' });
/** "true": solo pueden ingresar correos cargados en el directorio por Talento Humano. */
const REQUIRE_DIRECTORY = defineString('REQUIRE_DIRECTORY', { default: 'true' });
const SMTP_HOST = defineString('SMTP_HOST', { default: 'smtp.office365.com' });
const SMTP_PORT = defineString('SMTP_PORT', { default: '587' });
const SMTP_FROM = defineString('SMTP_FROM', { default: 'Muévete Netlife <bienestar@netlife.net.ec>' });
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

function requireAuth(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  return req.auth.uid;
}
function requireValidator(req: CallableRequest): string {
  const uid = requireAuth(req);
  const tok = req.auth!.token;
  if (tok.validator !== true && tok.admin !== true) {
    throw new HttpsError('permission-denied', 'Solo los responsables de validación pueden aprobar sellos.');
  }
  return uid;
}
function requireAdmin(req: CallableRequest): string {
  const uid = requireAuth(req);
  if (req.auth?.token.admin !== true) throw new HttpsError('permission-denied', 'Solo Talento Humano y el Comité pueden ver este panel.');
  return uid;
}

/* =====================================================================
 * 1. Ingreso con correo + código de 6 dígitos
 * ===================================================================== */
export const requestLoginCode = onCall({ secrets: [SMTP_USER, SMTP_PASS] }, async (req) => {
  const email = normalizeEmail(req.data?.email);
  if (!email) throw new HttpsError('invalid-argument', 'Escribe un correo válido.');
  const domain = ALLOWED_DOMAIN.value().toLowerCase();
  if (!email.endsWith('@' + domain)) {
    throw new HttpsError('permission-denied', `Usa tu correo institucional @${domain}.`);
  }
  if (REQUIRE_DIRECTORY.value() === 'true') {
    const dir = await db.doc(`directory/${email}`).get();
    if (!dir.exists || dir.get('active') === false) {
      throw new HttpsError('not-found', 'Tu correo no está registrado en el programa. Escribe a Talento Humano para que te agreguen.');
    }
  }

  const ref = db.doc(`loginCodes/${email}`);
  const prev = await ref.get();
  const sentAt = prev.get('sentAt') as Timestamp | undefined;
  if (sentAt && Date.now() - sentAt.toMillis() < 60_000) {
    throw new HttpsError('resource-exhausted', 'Ya te enviamos un código. Espera un minuto para pedir otro.');
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await ref.set({
    hash: hash(email + ':' + code),
    sentAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MIN * 60_000),
    attempts: 0,
  });

  if (IS_EMULATOR) {
    logger.info(`[emulador] Código de ingreso para ${email}: ${code}`);
    return { sent: true, devCode: code };
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST.value(),
    port: Number(SMTP_PORT.value()),
    secure: Number(SMTP_PORT.value()) === 465,
    auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
  });
  await transport.sendMail({
    from: SMTP_FROM.value(),
    to: email,
    subject: `${code} es tu código para Muévete Netlife`,
    text: `Tu código de ingreso es ${code}. Vence en ${CODE_TTL_MIN} minutos.\n\nSi no lo pediste, ignora este correo.`,
    html: `<p>Tu código de ingreso a <b>Muévete Netlife</b> es:</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p><p>Vence en ${CODE_TTL_MIN} minutos. Si no lo pediste, ignora este correo.</p>`,
  });
  return { sent: true };
});

export const verifyLoginCode = onCall(async (req) => {
  const email = normalizeEmail(req.data?.email);
  const code = String(req.data?.code ?? '').trim();
  if (!email || !/^\d{6}$/.test(code)) throw new HttpsError('invalid-argument', 'Escribe el código de 6 dígitos.');

  const ref = db.doc(`loginCodes/${email}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Pide un código nuevo.');
  const { hash: expected, expiresAt, attempts } = snap.data() as { hash: string; expiresAt: Timestamp; attempts: number };
  if (expiresAt.toMillis() < Date.now()) {
    await ref.delete();
    throw new HttpsError('deadline-exceeded', 'El código venció. Pide uno nuevo.');
  }
  if (attempts >= MAX_ATTEMPTS) {
    await ref.delete();
    throw new HttpsError('resource-exhausted', 'Demasiados intentos. Pide un código nuevo.');
  }
  const ok = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash(email + ':' + code), 'hex'));
  if (!ok) {
    await ref.update({ attempts: FieldValue.increment(1) });
    throw new HttpsError('permission-denied', `Código incorrecto. Te quedan ${MAX_ATTEMPTS - attempts - 1} intentos.`);
  }
  await ref.delete();

  const auth = getAuth();
  const user = await auth.getUserByEmail(email).catch(() => auth.createUser({ email, emailVerified: true }));
  const dir = (await db.doc(`directory/${email}`).get()).data() ?? {};
  const isAdmin = dir.role === 'admin';
  const isValidator = dir.role === 'validador';
  if ((user.customClaims?.admin === true) !== isAdmin || (user.customClaims?.validator === true) !== isValidator) {
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: isAdmin, validator: isValidator });
  }

  const userRef = db.doc(`users/${user.uid}`);
  const existing = await userRef.get();
  const profile = {
    email,
    name: dir.name ?? email.split('@')[0],
    dept: dir.dept ?? 'Sin departamento',
    employeeId: dir.employeeId ?? null,
    role: isAdmin ? 'admin' : isValidator ? 'validador' : 'colaborador',
    lastLoginAt: FieldValue.serverTimestamp(),
  };
  if (existing.exists) await userRef.update(profile);
  else await userRef.set({ ...profile, createdAt: FieldValue.serverTimestamp(), stats: emptyStats() });

  return { token: await auth.createCustomToken(user.uid, { admin: isAdmin, validator: isValidator }) };
});

/* =====================================================================
 * 2. Registro de actividad por QR (puntos, rachas, ranking y retos)
 * ===================================================================== */
type Tx = FirebaseFirestore.Transaction;

/**
 * Acredita una actividad validada dentro de una transacción: puntos, racha, retos,
 * logros del pasaporte, ranking y estadísticas. Hace todas sus lecturas antes de
 * escribir; el llamador no debe haber escrito nada antes.
 */
async function creditInTx(
  tx: Tx,
  args: { uid: string; user: FirebaseFirestore.DocumentData; stats: UserStats; activity: ActivityId; at: Date },
) {
  const { uid, user, activity, at } = args;
  const rule = ACTIVITIES[activity];
  const userRef = db.doc(`users/${uid}`);
  const day = dayKey(at);
  const periods = [monthKey(at), weekKey(at)];
  const dept: string = user.dept ?? 'Sin departamento';

  // Lecturas
  const scoreRefs = periods.map((p) => db.doc(`scores/${p}_${uid}`));
  const deptRefs = periods.map((p) => db.doc(`deptScores/${p}_${slug(dept)}`));
  const statRefs = periods.map((p) => db.doc(`stats/${p}`));
  const scoreSnaps = await Promise.all(scoreRefs.map((r) => tx.get(r)));
  const joined = await tx.get(userRef.collection('challenges').where('completed', '==', false));
  const defs = await Promise.all(joined.docs.map((d) => tx.get(db.doc(`challenges/${d.id}`))));

  // Retos
  let challengeBonus = 0;
  const completedChallenges: string[] = [];
  const challengeUpdates: { ref: FirebaseFirestore.DocumentReference; data: ChallengeProgress }[] = [];
  joined.docs.forEach((d, i) => {
    const def = defs[i].data() as ChallengeDef | undefined;
    if (!def) return;
    const next = advanceChallenge(def, d.data() as ChallengeProgress, activity, day);
    if (!next) return;
    challengeUpdates.push({ ref: d.ref, data: next });
    if (next.completed) {
      challengeBonus += def.bonus;
      completedChallenges.push(def.title);
    }
  });

  const { stats: credited, achievements } = creditActivity(args.stats, activity, at, rule.points);
  credited.totalPoints += challengeBonus;
  credited.challengesCompleted += completedChallenges.length;
  const passportBonus = achievements.reduce((n, a) => n + PASSPORT_ACHIEVEMENTS[a].bonus, 0);
  const bonus = challengeBonus + passportBonus;
  const gained = rule.points + bonus;

  // Escrituras
  tx.update(userRef, { stats: credited });
  challengeUpdates.forEach((u) => tx.update(u.ref, { ...u.data }));
  periods.forEach((period, i) => {
    const isNewParticipant = !scoreSnaps[i].exists;
    const inc = (n: number) => FieldValue.increment(n);
    tx.set(scoreRefs[i], { period, uid, name: user.name, dept, points: inc(gained), count: inc(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(deptRefs[i], { period, dept, points: inc(gained), count: inc(1), participants: inc(isNewParticipant ? 1 : 0) }, { merge: true });
    tx.set(
      statRefs[i],
      {
        period,
        total: inc(1),
        points: inc(gained),
        participants: inc(isNewParticipant ? 1 : 0),
        byActivity: { [activity]: inc(1) },
        pagesCompleted: inc(achievements.includes('page') ? 1 : 0),
        passportsCompleted: inc(achievements.includes('full') ? 1 : 0),
      },
      { merge: true },
    );
  });

  return {
    stats: credited,
    points: rule.points,
    bonus,
    completedChallenges,
    achievements: achievements.map((a) => PASSPORT_ACHIEVEMENTS[a].title),
  };
}

/* =====================================================================
 * 2. Registro por QR: sello en el pasaporte (validado o pendiente)
 * ===================================================================== */
export const registerActivity = onCall(async (req) => {
  const uid = requireAuth(req);
  const qr = parseQr(String(req.data?.qr ?? ''));
  if (!qr) throw new HttpsError('invalid-argument', 'Este código QR no pertenece al programa Muévete.');

  const qrSnap = await db.doc(`qrCodes/${qr.id}`).get();
  const q = qrSnap.data();
  if (!q || q.active === false || q.token !== qr.token || !isActivityId(q.activity)) {
    throw new HttpsError('failed-precondition', 'Este código QR ya no es válido. Avisa al Comité de Seguridad y Salud.');
  }
  const activity = q.activity;
  const rule = ACTIVITIES[activity];
  const requiresApproval = q.requiresApproval === true;

  return db.runTransaction(async (tx) => {
    const now = new Date();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'Tu perfil no existe. Vuelve a iniciar sesión.');
    const user = userSnap.data()!;
    const stats: UserStats = { ...emptyStats(), ...(user.stats ?? {}) };

    const check = canRegister(stats, activity, now);
    if (!check.ok) throw new HttpsError('failed-precondition', check.message!, { reason: check.reason });

    const { stats: reserved, stampNumber } = reserveStamp(stats, activity, now);
    const stampedAt = Timestamp.fromDate(now);
    const activityRef = userRef.collection('activities').doc();
    const base = { activity, qrId: qr.id, location: q.location ?? '', day: dayKey(now), stampNumber, createdAt: stampedAt };

    if (requiresApproval) {
      tx.update(userRef, { stats: reserved });
      tx.set(activityRef, { ...base, status: 'pending', points: 0, bonus: 0 });
      tx.set(db.doc(`approvals/${activityRef.id}`), {
        uid, name: user.name, dept: user.dept ?? 'Sin departamento', activity, activityId: activityRef.id,
        location: q.location ?? '', stampNumber, status: 'pending', createdAt: stampedAt,
      });
      return {
        activity, activityName: rule.name, location: q.location ?? '', status: 'pending' as const,
        points: 0, pendingPoints: rule.points, bonus: 0, completedChallenges: [], achievements: [],
        totalPoints: reserved.totalPoints, streak: reserved.streak, stampNumber, stampedAt: stampedAt.toMillis(),
      };
    }

    const c = await creditInTx(tx, { uid, user, stats: reserved, activity, at: now });
    tx.set(activityRef, { ...base, status: 'approved', points: c.points, bonus: c.bonus });
    return {
      activity, activityName: rule.name, location: q.location ?? '', status: 'approved' as const,
      points: c.points, pendingPoints: 0, bonus: c.bonus, completedChallenges: c.completedChallenges, achievements: c.achievements,
      totalPoints: c.stats.totalPoints, streak: c.stats.streak, stampNumber, stampedAt: stampedAt.toMillis(),
    };
  });
});

/** Un responsable (mesa de control) aprueba o rechaza un sello pendiente. */
export const reviewActivity = onCall(async (req) => {
  const reviewerUid = requireValidator(req);
  const approvalId = String(req.data?.approvalId ?? '');
  const approve = req.data?.approve === true;
  const note = typeof req.data?.note === 'string' ? req.data.note.slice(0, 200) : null;
  if (!approvalId) throw new HttpsError('invalid-argument', 'Falta el sello a revisar.');

  return db.runTransaction(async (tx) => {
    const apRef = db.doc(`approvals/${approvalId}`);
    const ap = (await tx.get(apRef)).data();
    if (!ap) throw new HttpsError('not-found', 'Este sello ya no existe.');
    if (ap.status !== 'pending') throw new HttpsError('failed-precondition', `Este sello ya fue ${ap.status === 'approved' ? 'aprobado' : 'rechazado'}.`);
    if (ap.uid === reviewerUid) throw new HttpsError('permission-denied', 'No puedes validar tu propio sello.');

    const userRef = db.doc(`users/${ap.uid}`);
    const actRef = userRef.collection('activities').doc(ap.activityId);
    const [userSnap, reviewerSnap] = await Promise.all([tx.get(userRef), tx.get(db.doc(`users/${reviewerUid}`))]);
    const user = userSnap.data();
    if (!user) throw new HttpsError('not-found', 'El colaborador ya no existe.');
    const stats: UserStats = { ...emptyStats(), ...(user.stats ?? {}) };
    const at = (ap.createdAt as Timestamp).toDate();
    const review = { reviewedBy: reviewerUid, reviewerName: reviewerSnap.get('name') ?? null, reviewedAt: FieldValue.serverTimestamp(), note };

    if (!approve) {
      tx.update(userRef, { stats: releaseStamp(stats, ap.activity, at) });
      tx.update(actRef, { status: 'rejected', ...review });
      tx.update(apRef, { status: 'rejected', ...review });
      return { status: 'rejected' as const };
    }
    const c = await creditInTx(tx, { uid: ap.uid, user, stats, activity: ap.activity, at });
    tx.update(actRef, { status: 'approved', points: c.points, bonus: c.bonus, ...review });
    tx.update(apRef, { status: 'approved', ...review });
    return { status: 'approved' as const, points: c.points, bonus: c.bonus };
  });
});

/* =====================================================================
 * 3. Retos y campañas
 * ===================================================================== */
export const joinChallenge = onCall(async (req) => {
  const uid = requireAuth(req);
  const id = String(req.data?.challengeId ?? '');
  const def = (await db.doc(`challenges/${id}`).get()).data();
  if (!def || def.active === false) throw new HttpsError('not-found', 'Este reto ya no está disponible.');
  const ref = db.doc(`users/${uid}/challenges/${id}`);
  if ((await ref.get()).exists) return { joined: true };
  const today = dayKey(new Date());
  const progress: ChallengeProgress = {
    joinedDay: today,
    endsDay: addDays(today, (def.durationDays as number) - 1),
    progress: 0,
    lastDay: null,
    completed: false,
  };
  await ref.set({ ...progress, title: def.title, goal: def.goal, bonus: def.bonus, joinedAt: FieldValue.serverTimestamp() });
  return { joined: true };
});

/* =====================================================================
 * 4. Panel de Talento Humano
 * ===================================================================== */
export const adminStats = onCall(async (req) => {
  requireAdmin(req);
  const now = new Date();
  const month = typeof req.data?.month === 'string' ? req.data.month : monthKey(now);

  // Últimas 8 semanas
  const weeks: string[] = [];
  for (let i = 7; i >= 0; i--) weeks.push(weekKey(new Date(now.getTime() - i * 7 * 86400000)));
  const [monthStat, weekStats, depts, deptScores, top, headcountSnap] = await Promise.all([
    db.doc(`stats/${month}`).get(),
    Promise.all(weeks.map((w) => db.doc(`stats/${w}`).get())),
    db.collection('departments').get(),
    db.collection('deptScores').where('period', '==', month).get(),
    db.collection('scores').where('period', '==', month).orderBy('points', 'desc').limit(200).get(),
    db.collection('directory').where('active', '==', true).count().get(),
  ]);
  const pending = await db.collection('approvals').where('status', '==', 'pending').count().get();

  const scoreByDept = new Map(deptScores.docs.map((d) => [d.get('dept') as string, d.data()]));
  const ms = monthStat.data() ?? {};
  return {
    month,
    headcount: headcountSnap.data().count,
    participants: ms.participants ?? 0,
    registrations: ms.total ?? 0,
    points: ms.points ?? 0,
    byActivity: ms.byActivity ?? {},
    pagesCompleted: ms.pagesCompleted ?? 0,
    passportsCompleted: ms.passportsCompleted ?? 0,
    pendingApprovals: pending.data().count,
    weekly: weekStats.map((s, i) => ({ week: weeks[i], total: s.get('total') ?? 0 })),
    departments: depts.docs.map((d) => {
      const name = d.get('name') as string;
      const s = scoreByDept.get(name) ?? {};
      return { name, headcount: d.get('headcount') ?? 0, participants: s.participants ?? 0, points: s.points ?? 0, count: s.count ?? 0 };
    }),
    people: top.docs.map((d) => ({
      uid: d.get('uid'),
      name: d.get('name'),
      dept: d.get('dept'),
      points: d.get('points'),
      count: d.get('count'),
      updatedAt: (d.get('updatedAt') as Timestamp | undefined)?.toMillis() ?? null,
    })),
  };
});

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
