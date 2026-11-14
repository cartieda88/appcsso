/**
 * Reglas del programa Muévete (puntos, límites diarios, rachas y periodos).
 * Funciones puras: se prueban en test/rules.test.ts y no dependen de Firebase.
 */

export type ActivityId = 'gradas' | 'gimnasio' | 'piscina' | 'futbol' | 'pausa' | 'pasos';

export interface ActivityRule {
  name: string;
  points: number;
  /** Registros válidos por persona y por día. */
  maxPerDay: number;
  /** Minutos mínimos entre dos registros de la misma actividad. */
  cooldownMinutes: number;
}

export const ACTIVITIES: Record<ActivityId, ActivityRule> = {
  gradas: { name: 'Gradas', points: 10, maxPerDay: 2, cooldownMinutes: 60 },
  gimnasio: { name: 'Gimnasio', points: 15, maxPerDay: 1, cooldownMinutes: 0 },
  piscina: { name: 'Piscina', points: 15, maxPerDay: 1, cooldownMinutes: 0 },
  futbol: { name: 'Fútbol', points: 20, maxPerDay: 1, cooldownMinutes: 0 },
  // Se registran desde la app, sin QR:
  pausa: { name: 'Pausa activa', points: 5, maxPerDay: 4, cooldownMinutes: 60 },
  pasos: { name: 'Meta de pasos', points: 10, maxPerDay: 1, cooldownMinutes: 0 },
};

/** Actividades con QR en un lugar físico; "Pasaporte completo" pide un sello de cada una. */
export const QR_ACTIVITIES: ActivityId[] = ['gradas', 'gimnasio', 'piscina', 'futbol'];

/* ---------- Pausas activas y pasos ---------- */
/** Duración mínima de la rutina guiada para que la pausa cuente. */
export const PAUSE_MIN_SECONDS = 120;
/** Meta diaria de pasos por defecto (se puede cambiar en config/steps.dailyGoal). */
export const STEP_GOAL_DEFAULT = 8000;
/** Tope de pasos aceptados por día (filtra errores del sensor). */
export const STEPS_MAX_PER_DAY = 70000;

export const isActivityId = (v: unknown): v is ActivityId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(ACTIVITIES, v);

/** Zona horaria de Netlife (Ecuador continental). */
export const TIME_ZONE = 'America/Guayaquil';

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') };
}

/** Día local, p. ej. "2026-11-13". */
export function dayKey(date: Date): string {
  const { y, m, d } = localParts(date);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function localHour(date: Date): number {
  return localParts(date).h;
}

/** Periodo mensual, p. ej. "M2026-11". */
export function monthKey(date: Date): string {
  const { y, m } = localParts(date);
  return `M${y}-${String(m).padStart(2, '0')}`;
}

/** Semana ISO 8601 (lunes a domingo), p. ej. "W2026-46". */
export function weekKey(date: Date): string {
  const { y, m, d } = localParts(date);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `W${t.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

/** Suma (o resta) días a una clave de día "YYYY-MM-DD". */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export interface MonthPassport {
  /** Sellos validados en el mes. */
  stamps: number;
  /** Actividades distintas con sello en el mes. */
  kinds: ActivityId[];
  /** Días del mes con al menos un sello validado. */
  days: string[];
  /** Logros del mes ya otorgados (para no premiar dos veces). */
  page: boolean;
  full: boolean;
}

export interface UserStats {
  totalPoints: number;
  /** Actividades validadas (con puntos). */
  totalActivities: number;
  /** Sellos emitidos, incluidos los pendientes de validación. Da el N° de sello. */
  stampsIssued: number;
  counts: Partial<Record<ActivityId, number>>;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  activeDays: number;
  earlyBird: boolean;
  /** Registros del día en curso (validados o pendientes), para aplicar límites. */
  today: { day: string; counts: Partial<Record<ActivityId, number>>; last: Partial<Record<ActivityId, number>> };
  challengesCompleted: number;
  /** Pasaporte por mes, clave "2026-11". */
  months: Record<string, MonthPassport>;
  pagesCompleted: number;
  passportsCompleted: number;
}

/* ---------- Pasaporte completo ---------- */
export const PAGE_SIZE = 9;
export const PASSPORT_ACHIEVEMENTS = {
  page: { title: 'Página completa', description: `${PAGE_SIZE} sellos en un mes`, bonus: 50 },
  full: { title: 'Pasaporte completo', description: 'Gradas, gimnasio, piscina y fútbol en un mismo mes', bonus: 50 },
} as const;
export type PassportAchievement = keyof typeof PASSPORT_ACHIEVEMENTS;

export const emptyStats = (): UserStats => ({
  totalPoints: 0,
  totalActivities: 0,
  stampsIssued: 0,
  counts: {},
  streak: 0,
  bestStreak: 0,
  lastActiveDay: null,
  activeDays: 0,
  earlyBird: false,
  today: { day: '', counts: {}, last: {} },
  challengesCompleted: 0,
  months: {},
  pagesCompleted: 0,
  passportsCompleted: 0,
});

const clone = (prev: UserStats): UserStats => JSON.parse(JSON.stringify({ ...emptyStats(), ...prev }));

export type RejectReason = 'daily-limit' | 'cooldown';

export interface CheckResult {
  ok: boolean;
  reason?: RejectReason;
  message?: string;
}

/** Valida si la persona puede registrar la actividad en este momento. */
export function canRegister(stats: UserStats, activity: ActivityId, now: Date): CheckResult {
  const rule = ACTIVITIES[activity];
  const day = dayKey(now);
  const today = stats.today.day === day ? stats.today : { day, counts: {}, last: {} };
  const count = today.counts[activity] ?? 0;
  if (count >= rule.maxPerDay) {
    return {
      ok: false,
      reason: 'daily-limit',
      message: `Ya registraste ${rule.name.toLowerCase()} ${rule.maxPerDay === 1 ? 'hoy' : `${rule.maxPerDay} veces hoy`}. Vuelve mañana para sumar más puntos.`,
    };
  }
  const last = today.last[activity];
  if (rule.cooldownMinutes > 0 && last && now.getTime() - last < rule.cooldownMinutes * 60000) {
    const wait = Math.ceil((rule.cooldownMinutes * 60000 - (now.getTime() - last)) / 60000);
    return { ok: false, reason: 'cooldown', message: `Espera ${wait} min para volver a registrar ${rule.name.toLowerCase()}.` };
  }
  return { ok: true };
}

/**
 * Paso 1 de todo registro (validado o pendiente): ocupa el cupo del día y
 * emite el número de sello.
 */
export function reserveStamp(prev: UserStats, activity: ActivityId, now: Date): { stats: UserStats; stampNumber: number } {
  const s = clone(prev);
  const day = dayKey(now);
  if (s.today.day !== day) s.today = { day, counts: {}, last: {} };
  s.today.counts[activity] = (s.today.counts[activity] ?? 0) + 1;
  s.today.last[activity] = now.getTime();
  s.stampsIssued = Math.max(s.stampsIssued, s.totalActivities) + 1;
  return { stats: s, stampNumber: s.stampsIssued };
}

/** Libera el cupo del día de un sello rechazado (si sigue siendo el mismo día). */
export function releaseStamp(prev: UserStats, activity: ActivityId, at: Date): UserStats {
  const s = clone(prev);
  if (s.today.day === dayKey(at)) s.today.counts[activity] = Math.max(0, (s.today.counts[activity] ?? 0) - 1);
  return s;
}

/**
 * Paso 2: acredita una actividad validada (puntos, racha, conteos y pasaporte del mes).
 * `at` es la hora del registro, no la de la aprobación.
 */
export function creditActivity(
  prev: UserStats,
  activity: ActivityId,
  at: Date,
  points: number,
): { stats: UserStats; achievements: PassportAchievement[] } {
  const s = clone(prev);
  const day = dayKey(at);
  const ym = monthKey(at).slice(1);
  const m: MonthPassport = s.months[ym] ?? { stamps: 0, kinds: [], days: [], page: false, full: false };

  // Racha y días activos. Si se aprueba tarde un día anterior al último activo,
  // cuenta como día activo pero no recalcula la racha.
  if (!m.days.includes(day)) {
    m.days.push(day);
    s.activeDays += 1;
  }
  if (!s.lastActiveDay || day > s.lastActiveDay) {
    s.streak = s.lastActiveDay === addDays(day, -1) ? s.streak + 1 : 1;
    s.lastActiveDay = day;
  }
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.totalPoints += points;
  s.totalActivities += 1;
  s.counts[activity] = (s.counts[activity] ?? 0) + 1;
  if (localHour(at) < 8) s.earlyBird = true;

  // Pasaporte del mes
  m.stamps += 1;
  if (!m.kinds.includes(activity)) m.kinds.push(activity);
  const achievements: PassportAchievement[] = [];
  if (!m.page && m.stamps >= PAGE_SIZE) {
    m.page = true;
    s.pagesCompleted += 1;
    achievements.push('page');
  }
  if (!m.full && QR_ACTIVITIES.every((a) => m.kinds.includes(a))) {
    m.full = true;
    s.passportsCompleted += 1;
    achievements.push('full');
  }
  for (const a of achievements) s.totalPoints += PASSPORT_ACHIEVEMENTS[a].bonus;
  s.months[ym] = m;
  return { stats: s, achievements };
}

/** Registro validado de inmediato (reserva + acreditación). */
export function applyActivity(prev: UserStats, activity: ActivityId, now: Date, points: number): UserStats {
  return creditActivity(reserveStamp(prev, activity, now).stats, activity, now, points).stats;
}

export interface ChallengeDef {
  title: string;
  /** "days": días distintos con actividad. "count": número de registros. */
  kind: 'days' | 'count';
  /** Si se indica, solo cuenta esa actividad. */
  activity: ActivityId | null;
  goal: number;
  durationDays: number;
  bonus: number;
}

export interface ChallengeProgress {
  joinedDay: string;
  endsDay: string;
  progress: number;
  lastDay: string | null;
  completed: boolean;
}

/** Avanza un reto con un registro. Devuelve null si el registro no cuenta. */
export function advanceChallenge(
  def: ChallengeDef,
  p: ChallengeProgress,
  activity: ActivityId,
  day: string,
): ChallengeProgress | null {
  if (p.completed) return null;
  if (day < p.joinedDay || day > p.endsDay) return null;
  if (def.activity && def.activity !== activity) return null;
  if (def.kind === 'days' && p.lastDay === day) return null;
  const progress = p.progress + 1;
  return { ...p, progress, lastDay: day, completed: progress >= def.goal };
}

/**
 * Interpreta el contenido de un QR del programa. Acepta:
 * - Enlace (nuevo): https://<sitio>/r/<id>/<token>, que se abre con la cámara de cualquier teléfono.
 * - Texto (anterior): MUEVETE:<id>:<token>
 */
export function parseQr(raw: string): { id: string; token: string } | null {
  const s = raw.trim();
  const m = /^MUEVETE:([A-Za-z0-9_-]{2,40}):([A-Za-z0-9]{8,64})$/.exec(s) ?? /^https:\/\/[^/\s]+\/r\/([A-Za-z0-9_-]{2,40})\/([A-Za-z0-9]{8,64})\/?$/.exec(s);
  return m ? { id: m[1], token: m[2] } : null;
}

/** Enlace que va dentro del QR impreso. */
export const qrUrl = (baseUrl: string, id: string, token: string) => `${baseUrl.replace(/\/+$/, '')}/r/${id}/${token}`;

/* ---------- Recordatorios de pausas activas enviados por el servidor (versión web) ---------- */
export interface PauseReminderPrefs { enabled: boolean; every: number; start: number; end: number; weekdays: number[] }

/**
 * Si a esta hora local (Ecuador) toca recordatorio de pausa. Los recordatorios caen en
 * start+every, start+2·every… antes de end; el servidor revisa cada 15 min.
 * weekdays: 1 = domingo … 7 = sábado.
 */
export function isPauseTime(p: PauseReminderPrefs, now: Date): boolean {
  if (!p.enabled || !(p.every >= 30)) return false;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const g = (t: string) => parts.find((x) => x.type === t)!.value;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')) + 1;
  if (!p.weekdays.includes(weekday)) return false;
  const minute = Number(g('hour')) * 60 + Math.floor(Number(g('minute')) / 15) * 15;
  const since = minute - p.start * 60;
  return since > 0 && minute < p.end * 60 && since % p.every === 0;
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Fin del día local (23:59) de una clave "YYYY-MM-DD", como instante. Ecuador: UTC-5 fijo. */
export function endOfLocalDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23 + 5, 59));
}

/* ---------- Recordatorios de eventos ---------- */
export type ReminderKind = 'd1' | 'd0';
/** Hora local del recordatorio del mismo día. */
export const SAME_DAY_REMINDER_HOUR = 7;

/**
 * Qué recordatorios corresponde enviar ahora para un evento:
 * - d1: entre 24 h y 2 h antes, si el evento no es hoy (mañana / en 24 horas).
 * - d0: el mismo día desde las 07:00, o 3 h antes si empieza más temprano, y antes del inicio.
 */
export function dueReminders(startsAt: Date, now: Date, sent: Partial<Record<ReminderKind, boolean>>): ReminderKind[] {
  const ms = startsAt.getTime() - now.getTime();
  if (ms <= 0) return [];
  const out: ReminderKind[] = [];
  const sameDay = dayKey(startsAt) === dayKey(now);
  if (!sent.d1 && !sameDay && ms <= 24 * 3600_000 && ms > 2 * 3600_000) out.push('d1');
  if (!sent.d0 && sameDay && (localHour(now) >= SAME_DAY_REMINDER_HOUR || ms <= 3 * 3600_000)) out.push('d0');
  return out;
}
