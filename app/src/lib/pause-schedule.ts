/** Horario de recordatorios de pausas activas (compartido por la app y la versión web). */
export interface PausePrefs {
  enabled: boolean;
  /** Minutos entre recordatorios. */
  every: 60 | 90 | 120;
  /** Horario laboral, hora local. */
  start: number;
  end: number;
  /** Días: 1 = domingo … 7 = sábado. */
  weekdays: number[];
}
export const DEFAULT_PAUSE_PREFS: PausePrefs = { enabled: false, every: 90, start: 8, end: 17, weekdays: [2, 3, 4, 5, 6] };

/** Horas (h, m) del día en que suena el recordatorio. */
export function pauseTimes(p: PausePrefs): { h: number; m: number }[] {
  const out: { h: number; m: number }[] = [];
  for (let t = p.start * 60 + p.every; t < p.end * 60; t += p.every) out.push({ h: Math.floor(t / 60), m: t % 60 });
  return out;
}

/** Próximo recordatorio, para mostrarlo en la app. */
export function nextPause(p: PausePrefs, now = new Date()): Date | null {
  if (!p.enabled) return null;
  const times = pauseTimes(p);
  for (let add = 0; add < 8; add++) {
    const d = new Date(now); d.setDate(d.getDate() + add);
    if (!p.weekdays.includes(d.getDay() + 1)) continue;
    for (const { h, m } of times) {
      const c = new Date(d); c.setHours(h, m, 0, 0);
      if (c > now) return c;
    }
  }
  return null;
}
