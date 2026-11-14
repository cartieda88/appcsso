import { collection, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { db } from './firebase';
import { ACTIVITIES } from './program';
import { useSession } from './session';
import type { Theme } from './theme';

/** Actividad tal como la ve la app (de fábrica o creada por Talento Humano en Gestión). */
export interface ActivityInfo {
  id: string;
  name: string;
  points: number;
  maxPerDay: number;
  cooldownMinutes: number;
  kind: 'qr' | 'app';
  requiresApproval: boolean;
  passport: boolean;
  active: boolean;
  icon: string;
  color: string;
  order: number;
  /** Regla en palabras, para mostrar. */
  rule: string;
}

const describe = (a: Omit<ActivityInfo, 'rule'>) => {
  if (a.id === 'pausa') return 'Rutina guiada de 2 min; hasta 4 al día, cada hora';
  if (a.id === 'pasos') return 'Al llegar a la meta diaria de pasos';
  const parts = [a.maxPerDay === 1 ? 'Una vez al día' : `Hasta ${a.maxPerDay} al día`];
  if (a.cooldownMinutes) parts.push(`con ${a.cooldownMinutes >= 60 && a.cooldownMinutes % 60 === 0 ? `${a.cooldownMinutes / 60} h` : `${a.cooldownMinutes} min`} entre registros`);
  if (a.requiresApproval) parts.push('la valida la mesa de control');
  return parts.join(', ');
};

function build(stored: Record<string, Record<string, unknown>>): ActivityInfo[] {
  const ids = new Set([...Object.keys(ACTIVITIES), ...Object.keys(stored)]);
  return [...ids].map((id) => {
    const base = ACTIVITIES[id] ?? { name: id, points: 10, maxPerDay: 1, cooldownMinutes: 0, kind: 'qr', requiresApproval: false, passport: false, icon: 'star', color: 'gradas', order: 50, rule: '' };
    const s = stored[id] ?? {};
    const a = {
      id,
      name: String(s.name ?? base.name),
      points: Number(s.points ?? base.points),
      maxPerDay: Number(s.maxPerDay ?? base.maxPerDay),
      cooldownMinutes: Number(s.cooldownMinutes ?? base.cooldownMinutes),
      kind: (s.kind ?? base.kind) === 'app' ? 'app' as const : 'qr' as const,
      requiresApproval: Boolean(s.requiresApproval ?? base.requiresApproval),
      passport: Boolean(s.passport ?? base.passport),
      active: s.active !== false,
      icon: String(s.icon ?? base.icon),
      color: String(s.color ?? base.color),
      order: Number(s.order ?? base.order),
    };
    return { ...a, rule: describe(a) };
  }).sort((x, y) => x.order - y.order || x.name.localeCompare(y.name));
}

export interface Catalog {
  /** Todas, incluidas las desactivadas (para mostrar sellos antiguos). */
  all: ActivityInfo[];
  /** Activas, en orden. */
  list: ActivityInfo[];
  /** Activas que se registran con QR. */
  qr: ActivityInfo[];
  /** Ids que pide "Pasaporte completo". */
  passportIds: string[];
  get(id: string): ActivityInfo;
  color(t: Theme, id: string): string;
}

function makeCatalog(all: ActivityInfo[]): Catalog {
  const byId = new Map(all.map((a) => [a.id, a]));
  const list = all.filter((a) => a.active);
  return {
    all,
    list,
    qr: list.filter((a) => a.kind === 'qr'),
    passportIds: list.filter((a) => a.passport).map((a) => a.id),
    get: (id) => byId.get(id) ?? { ...build({ [id]: {} })[0], name: id },
    color: (t, id) => t.act[(byId.get(id)?.color ?? id) as keyof Theme['act']] ?? t.act.gradas,
  };
}

const Ctx = createContext<Catalog>(makeCatalog(build({})));

/** Lee las actividades vigentes de Firestore (colección `activities`), con las de fábrica como base. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [stored, setStored] = useState<Record<string, Record<string, unknown>>>({});
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'activities'), (s) => setStored(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))), () => {});
  }, [user]);
  const value = useMemo(() => makeCatalog(build(stored)), [stored]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCatalog = () => useContext(Ctx);
