import { syncSteps } from './api';
import { notifyLocal } from './notifications';
import { dayKey } from './program';
import { stepsSource } from './steps-source';

/** Inicio del día local (Ecuador, UTC-5 fijo) de una clave "YYYY-MM-DD". */
function startOfDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 5));
}
const prevDay = (day: string) => dayKey(new Date(startOfDay(day).getTime() - 12 * 3600_000));

export interface StepsStatus { steps: number; goal: number; goalReachedNow: boolean }

/**
 * Lee los pasos de hoy y de ayer, los envía al servidor y avisa con una
 * notificación si en esta sincronización se llegó a la meta.
 * Devuelve null si no hay podómetro o falta el permiso.
 */
export async function syncTodaySteps(): Promise<StepsStatus | null> {
  if (!(await stepsSource.isAvailable()) || !(await stepsSource.hasAccess())) return null;
  const today = dayKey();
  const yesterday = prevDay(today);
  const now = new Date();
  const [stepsToday, stepsYesterday] = await Promise.all([
    stepsSource.read(startOfDay(today), now),
    stepsSource.read(startOfDay(yesterday), startOfDay(today)),
  ]);
  const { data } = await syncSteps({ days: [{ day: yesterday, steps: stepsYesterday }, { day: today, steps: stepsToday }], source: stepsSource.name });
  for (const r of data.results) {
    if (r.goalReachedNow) {
      await notifyLocal({
        title: r.day === today ? '¡Llegaste a tu meta de pasos!' : 'Ayer llegaste a tu meta de pasos',
        body: `${r.steps.toLocaleString('es-EC')} pasos · +${r.points} puntos y un sello nuevo en tu pasaporte.`,
        url: '/pasaporte',
        channelId: 'logros',
      });
    }
  }
  const t = data.results.find((r) => r.day === today);
  return { steps: t?.steps ?? stepsToday, goal: data.goal, goalReachedNow: !!t?.goalReachedNow };
}
