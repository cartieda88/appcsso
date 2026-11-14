// En el navegador (panel de Talento Humano) no hay notificaciones ni recordatorios.
export interface PausePrefs { enabled: boolean; every: 60 | 90 | 120; start: number; end: number; weekdays: number[] }
export const DEFAULT_PAUSE_PREFS: PausePrefs = { enabled: false, every: 90, start: 8, end: 17, weekdays: [2, 3, 4, 5, 6] };
export const configureNotifications = async () => {};
export const ensurePermission = async () => false;
export const registerForPush = async (): Promise<'ok' | 'denied' | 'unsupported'> => 'unsupported';
export const unregisterPush = async () => {};
export const notifyLocal = async (_n: { title: string; body: string; url?: string; channelId?: string }) => {};
export const loadPausePrefs = async () => DEFAULT_PAUSE_PREFS;
export const savePausePrefs = async (_p: PausePrefs): Promise<'ok' | 'denied'> => 'ok';
export const pauseTimes = (_p: PausePrefs) => [] as { h: number; m: number }[];
export const nextPause = (_p: PausePrefs, _now?: Date): Date | null => null;
export const onNotificationOpen = (_go: (url: string) => void) => () => {};
