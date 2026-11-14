import { Pedometer } from 'expo-sensors';

import type { StepsSource } from './steps-source';

export type { StepsSource } from './steps-source';

/** iPhone: CoreMotion guarda los pasos de los últimos 7 días aunque la app esté cerrada. */
export const stepsSource: StepsSource = {
  name: 'Podómetro del iPhone',
  isAvailable: () => Pedometer.isAvailableAsync(),
  hasAccess: async () => (await Pedometer.getPermissionsAsync()).granted,
  requestAccess: async () => (await Pedometer.requestPermissionsAsync()).granted,
  read: async (start, end) => (await Pedometer.getStepCountAsync(start, end)).steps,
};
