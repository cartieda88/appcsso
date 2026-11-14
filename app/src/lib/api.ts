import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';

import { functions } from './firebase';
import type { ActivityId } from './program';

const call = <Req, Res>(name: string) => httpsCallable<Req, Res>(functions, name);

export const requestLoginCode = call<{ email: string }, { sent: boolean; devCode?: string }>('requestLoginCode');
export const verifyLoginCode = call<{ email: string; code: string }, { token: string }>('verifyLoginCode');
export const joinChallenge = call<{ challengeId: string }, { joined: boolean }>('joinChallenge');

export interface RegisterResult {
  activity: ActivityId;
  activityName: string;
  location: string;
  points: number;
  bonus: number;
  completedChallenges: string[];
  totalPoints: number;
  streak: number;
  stampNumber: number;
  stampedAt: number;
}
export const registerActivity = call<{ qr: string }, RegisterResult>('registerActivity');

export interface AdminStats {
  month: string;
  headcount: number;
  participants: number;
  registrations: number;
  points: number;
  byActivity: Partial<Record<ActivityId, number>>;
  weekly: { week: string; total: number }[];
  departments: { name: string; headcount: number; participants: number; points: number; count: number }[];
  people: { uid: string; name: string; dept: string; points: number; count: number; updatedAt: number | null }[];
}
export const adminStats = call<{ month?: string }, AdminStats>('adminStats');

/** Mensaje legible para mostrar al colaborador. */
export function errorMessage(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (e.code === 'functions/unavailable' || e.code === 'functions/deadline-exceeded') return 'Sin conexión. Revisa tu internet e inténtalo otra vez.';
    return e.message.replace(/^Firebase: /, '');
  }
  return 'Algo salió mal. Inténtalo otra vez.';
}
