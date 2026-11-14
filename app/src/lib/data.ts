import { collection, doc, limit, onSnapshot, orderBy, query, Timestamp, where, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import type { ActivityId } from './program';
import { useSession } from './session';

function useLive<T>(build: () => ReturnType<typeof query> | null, map: (id: string, d: DocumentData) => T, deps: unknown[]) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const q = build();
    if (!q) return;
    return onSnapshot(
      q,
      (s) => { setRows(s.docs.map((d) => map(d.id, d.data() as DocumentData))); setError(null); },
      (e) => setError(e.message),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { rows, error };
}

export type StampStatus = 'approved' | 'pending' | 'rejected';
export interface ActivityLog {
  id: string; activity: ActivityId; location: string; points: number; bonus: number; at: number; stampNumber: number | null;
  status: StampStatus; reviewerName: string | null; note: string | null;
}

const toLog = (id: string, d: DocumentData): ActivityLog => ({
  id, activity: d.activity, location: d.location, points: d.points, bonus: d.bonus ?? 0,
  at: d.createdAt?.toMillis?.() ?? Date.now(), stampNumber: d.stampNumber ?? null,
  status: d.status ?? 'approved', reviewerName: d.reviewerName ?? null, note: d.note ?? null,
});

export function useRecentActivities(n = 10) {
  const { user } = useSession();
  return useLive<ActivityLog>(
    () => (user ? query(collection(db, 'users', user.uid, 'activities'), orderBy('createdAt', 'desc'), limit(n)) : null),
    toLog,
    [user?.uid, n],
  );
}

export interface ScoreRow { id: string; uid: string; name: string; dept: string; points: number; count: number }
export function usePeopleRanking(period: string) {
  return useLive<ScoreRow>(
    () => query(collection(db, 'scores'), where('period', '==', period), orderBy('points', 'desc'), limit(50)),
    (id, d) => ({ id, uid: d.uid, name: d.name, dept: d.dept, points: d.points ?? 0, count: d.count ?? 0 }),
    [period],
  );
}

export interface DeptRow { name: string; headcount: number; points: number; participants: number; avg: number }
export function useDeptRanking(period: string) {
  const depts = useLive(() => query(collection(db, 'departments')), (_id, d) => ({ name: d.name as string, headcount: (d.headcount as number) ?? 0 }), []);
  const scores = useLive(
    () => query(collection(db, 'deptScores'), where('period', '==', period)),
    (_id, d) => ({ dept: d.dept as string, points: (d.points as number) ?? 0, participants: (d.participants as number) ?? 0 }),
    [period],
  );
  if (!depts.rows || !scores.rows) return { rows: null, error: depts.error ?? scores.error };
  const by = new Map(scores.rows.map((s) => [s.dept, s]));
  const rows: DeptRow[] = depts.rows
    .map((d) => {
      const s = by.get(d.name);
      const points = s?.points ?? 0;
      return { name: d.name, headcount: d.headcount, points, participants: s?.participants ?? 0, avg: d.headcount ? Math.round(points / d.headcount) : 0 };
    })
    .sort((a, b) => b.avg - a.avg);
  return { rows, error: null };
}

export interface Challenge { id: string; title: string; description: string; kind: 'days' | 'count'; activity: ActivityId | null; goal: number; durationDays: number; bonus: number }
export interface JoinedChallenge { id: string; progress: number; goal: number; completed: boolean; joinedDay: string; endsDay: string }

export function useChallenges() {
  const { user } = useSession();
  const all = useLive<Challenge>(
    () => query(collection(db, 'challenges'), where('active', '==', true)),
    (id, d) => ({ id, ...(d as Omit<Challenge, 'id'>) }),
    [],
  );
  const mine = useLive<JoinedChallenge>(
    () => (user ? query(collection(db, 'users', user.uid, 'challenges')) : null),
    (id, d) => ({ id, progress: d.progress, goal: d.goal, completed: d.completed, joinedDay: d.joinedDay, endsDay: d.endsDay }),
    [user?.uid],
  );
  return { challenges: all.rows, joined: mine.rows, error: all.error ?? mine.error };
}

/** Campaña destacada que edita el Comité en Firestore: config/campaign { title, description, active }. */
export function useCampaign() {
  const [c, setC] = useState<{ title: string; description: string } | null>(null);
  useEffect(() => onSnapshot(doc(db, 'config', 'campaign'), (s) => setC(s.exists() && s.get('active') !== false ? (s.data() as { title: string; description: string }) : null), () => setC(null)), []);
  return c;
}

/**
 * Sellos del pasaporte de un mes (hora de Ecuador, UTC-5 sin horario de verano).
 * month: 1-12.
 */
export function usePassport(year: number, month: number) {
  const { user } = useSession();
  const start = Timestamp.fromMillis(Date.UTC(year, month - 1, 1, 5));
  const end = Timestamp.fromMillis(Date.UTC(year, month, 1, 5));
  return useLive<ActivityLog>(
    () => (user ? query(collection(db, 'users', user.uid, 'activities'), where('createdAt', '>=', start), where('createdAt', '<', end), orderBy('createdAt', 'asc')) : null),
    toLog,
    [user?.uid, year, month],
  );
}

export interface PendingStamp { id: string; uid: string; name: string; dept: string; activity: ActivityId; location: string; stampNumber: number; at: number }

/** Sellos que esperan validación (solo responsables y Talento Humano). */
export function usePendingApprovals() {
  return useLive<PendingStamp>(
    () => query(collection(db, 'approvals'), where('status', '==', 'pending'), orderBy('createdAt', 'asc'), limit(100)),
    (id, d) => ({ id, uid: d.uid, name: d.name, dept: d.dept, activity: d.activity, location: d.location, stampNumber: d.stampNumber, at: d.createdAt?.toMillis?.() ?? 0 }),
    [],
  );
}
