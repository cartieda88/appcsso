/**
 * Datos de presentación del programa. Las reglas que valen (puntos, límites)
 * se aplican en el servidor: functions/src/rules.ts. Mantén ambos en sincronía.
 */
export type ActivityId = 'gradas' | 'gimnasio' | 'piscina' | 'futbol';

export const ACTIVITIES: Record<ActivityId, { name: string; points: number; maxPerDay: number; rule: string }> = {
  gradas: { name: 'Gradas', points: 10, maxPerDay: 2, rule: 'Hasta 2 registros al día, con 1 hora entre ellos' },
  gimnasio: { name: 'Gimnasio', points: 15, maxPerDay: 1, rule: 'Una sesión al día' },
  piscina: { name: 'Piscina', points: 15, maxPerDay: 1, rule: 'Una sesión al día' },
  futbol: { name: 'Fútbol', points: 20, maxPerDay: 1, rule: 'Un partido del campeonato al día' },
};
export const ACTIVITY_IDS = Object.keys(ACTIVITIES) as ActivityId[];

export interface UserStats {
  totalPoints: number;
  totalActivities: number;
  counts: Partial<Record<ActivityId, number>>;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  activeDays: number;
  earlyBird: boolean;
  today: { day: string; counts: Partial<Record<ActivityId, number>> };
  challengesCompleted: number;
}

export const LEVELS = [
  { name: 'Inicial', min: 0 },
  { name: 'Activo', min: 250 },
  { name: 'Constante', min: 600 },
  { name: 'Atleta Netlife', min: 1000 },
  { name: 'Embajador del bienestar', min: 1600 },
];

export function levelFor(points: number) {
  let i = 0;
  LEVELS.forEach((l, k) => { if (points >= l.min) i = k; });
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  const progress = next ? (points - cur.min) / (next.min - cur.min) : 1;
  return { index: i, cur, next, progress };
}

export type BadgeIcon = ActivityId | 'check' | 'fire' | 'star' | 'sun' | 'flag';
export interface Badge { name: string; desc: string; icon: BadgeIcon; earned: boolean; progress?: number }

export function badgesFor(s: UserStats): Badge[] {
  const c = (a: ActivityId) => s.counts[a] ?? 0;
  const kinds = ACTIVITY_IDS.filter((a) => c(a) > 0).length;
  const b = (name: string, desc: string, icon: BadgeIcon, value: number, goal: number): Badge =>
    ({ name, desc, icon, earned: value >= goal, progress: Math.min(1, value / goal) });
  return [
    b('Primer paso', 'Tu primer registro', 'check', s.totalActivities, 1),
    b('Escalador', '20 registros en gradas', 'gradas', c('gradas'), 20),
    b('Racha de 7', '7 días seguidos', 'fire', s.bestStreak, 7),
    b('Multideporte', 'Las 4 actividades', 'star', kinds, 4),
    { name: 'Madrugador', desc: 'Actividad antes de 8:00', icon: 'sun', earned: s.earlyBird },
    b('Goleador', '5 partidos jugados', 'futbol', c('futbol'), 5),
    b('Nadador', '10 sesiones de piscina', 'piscina', c('piscina'), 10),
    b('Fuerza', '15 sesiones de gimnasio', 'gimnasio', c('gimnasio'), 15),
    b('Reto cumplido', 'Completa un reto', 'flag', s.challengesCompleted, 1),
  ];
}

/* Periodos en hora de Ecuador (igual que el servidor). */
const TZ = 'America/Guayaquil';
function parts(date: Date) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { y: g('year'), m: g('month'), d: g('day') };
}
export function dayKey(date = new Date()) {
  const { y, m, d } = parts(date);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function monthKey(date = new Date()) {
  const { y, m } = parts(date);
  return `M${y}-${String(m).padStart(2, '0')}`;
}
export function weekKey(date = new Date()) {
  const { y, m, d } = parts(date);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7);
  return `W${t.getUTCFullYear()}-${String(w).padStart(2, '0')}`;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'N';

export function relativeDay(ms: number) {
  const d = dayKey(new Date(ms));
  if (d === dayKey()) return 'Hoy';
  if (d === dayKey(new Date(Date.now() - 86400000))) return 'Ayer';
  return new Date(ms).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' });
}
