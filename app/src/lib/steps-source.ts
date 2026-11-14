/**
 * Fuente de pasos del teléfono. Hay una versión por plataforma:
 * - steps-source.ios.ts: podómetro del iPhone (CoreMotion).
 * - steps-source.android.ts: Health Connect (Google Fit, Samsung Health, relojes…).
 * Este archivo es la versión web (panel en el navegador): no cuenta pasos.
 */
export interface StepsSource {
  /** Nombre que ve el colaborador, p. ej. "Health Connect". */
  name: string;
  isAvailable(): Promise<boolean>;
  hasAccess(): Promise<boolean>;
  requestAccess(): Promise<boolean>;
  /** Pasos entre dos instantes. */
  read(start: Date, end: Date): Promise<number>;
  /** Si la fuente necesita la app instalada desde la tienda (Android sin Health Connect). */
  installHint?: string;
}

export const stepsSource: StepsSource = {
  name: 'Sin podómetro',
  isAvailable: async () => false,
  hasAccess: async () => false,
  requestAccess: async () => false,
  read: async () => 0,
};
