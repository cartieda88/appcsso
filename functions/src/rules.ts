/**
 * Reglas del programa Muévete (puntos, límites diarios, rachas y periodos).
 * Funciones puras: se prueban en test/rules.test.ts y no dependen de Firebase.
 */

export type ActivityId = 'gradas' | 'gimnasio' | 'piscina' | 'futbol';

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
};

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

export interface UserStats {
  totalPoints: number;
  totalActivities: number;
  counts: Partial<Record<ActivityId, number>>;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  activeDays: number;
  earlyBird: boolean;
  /** Registros del día en curso, para aplicar límites. */
  today: { day: string; counts: Partial<Record<ActivityId, number>>; last: Partial<Record<ActivityId, number>> };
  challengesCompleted: number;
}

export const emptyStats = (): UserStats => ({
  totalPoints: 0,
  totalActivities: 0,
  counts: {},
  streak: 0,
  bestStreak: 0,
  lastActiveDay: null,
  activeDays: 0,
  earlyBird: false,
  today: { day: '', counts: {}, last: {} },
  challengesCompleted: 0,
});

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

/** Devuelve las estadísticas actualizadas tras un registro válido. */
export function applyActivity(prev: UserStats, activity: ActivityId, now: Date, points: number): UserStats {
  const s: UserStats = JSON.parse(JSON.stringify({ ...emptyStats(), ...prev }));
  const day = dayKey(now);
  if (s.today.day !== day) s.today = { day, counts: {}, last: {} };
  s.today.counts[activity] = (s.today.counts[activity] ?? 0) + 1;
  s.today.last[activity] = now.getTime();

  if (s.lastActiveDay !== day) {
    s.streak = s.lastActiveDay === addDays(day, -1) ? s.streak + 1 : 1;
    s.activeDays += 1;
    s.lastActiveDay = day;
  }
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.totalPoints += points;
  s.totalActivities += 1;
  s.counts[activity] = (s.counts[activity] ?? 0) + 1;
  if (localHour(now) < 8) s.earlyBird = true;
  return s;
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

/** Interpreta el contenido de un QR del programa. Formato: MUEVETE:<id>:<token> */
export function parseQr(raw: string): { id: string; token: string } | null {
  const m = /^MUEVETE:([A-Za-z0-9_-]{2,40}):([A-Za-z0-9]{8,64})$/.exec(raw.trim());
  return m ? { id: m[1], token: m[2] } : null;
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
