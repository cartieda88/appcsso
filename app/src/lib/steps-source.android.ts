import {
  aggregateRecord, getGrantedPermissions, getSdkStatus, initialize, requestPermission, SdkAvailabilityStatus,
} from 'react-native-health-connect';

import type { StepsSource } from './steps-source';

export type { StepsSource } from './steps-source';

let ready: Promise<boolean> | null = null;
const init = () => (ready ??= (async () => {
  if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
  return initialize();
})().catch(() => { ready = null; return false; }));

/**
 * Android: Health Connect reúne los pasos del teléfono, Google Fit, Samsung Health
 * y relojes. Se pide leer pasos y leerlos en segundo plano (para avisar la meta).
 */
export const stepsSource: StepsSource = {
  name: 'Health Connect',
  installHint: 'Instala o actualiza "Health Connect" desde Play Store para contar tus pasos.',
  isAvailable: init,
  hasAccess: async () => {
    if (!(await init())) return false;
    const granted = await getGrantedPermissions();
    return granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
  },
  requestAccess: async () => {
    if (!(await init())) return false;
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'BackgroundAccessPermission' },
    ]);
    return granted.some((p) => p.recordType === 'Steps');
  },
  read: async (start, end) => {
    const r = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    return r.COUNT_TOTAL ?? 0;
  },
};
