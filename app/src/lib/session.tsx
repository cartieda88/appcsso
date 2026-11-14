import { onAuthStateChanged, signInWithCustomToken, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { verifyLoginCode } from './api';
import { auth, db } from './firebase';
import type { UserStats } from './program';

export interface Profile {
  name: string;
  email: string;
  dept: string;
  employeeId: string | null;
  role: 'admin' | 'validador' | 'colaborador';
  stats: UserStats;
}

interface Session {
  ready: boolean;
  user: User | null;
  isAdmin: boolean;
  /** Puede aprobar sellos pendientes (mesa de control o Talento Humano). */
  isValidator: boolean;
  profile: Profile | null;
  signInWithCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isValidator, setIsValidator] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        const claims = u ? (await u.getIdTokenResult()).claims : {};
        setIsAdmin(claims.admin === true);
        setIsValidator(claims.validator === true || claims.admin === true);
        if (!u) setProfile(null);
        setReady(true);
      }),
    [],
  );

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (s) => setProfile(s.exists() ? (s.data() as Profile) : null));
  }, [user]);

  const value: Session = {
    ready,
    user,
    isAdmin,
    isValidator,
    profile,
    async signInWithCode(email, code) {
      const { data } = await verifyLoginCode({ email, code });
      await signInWithCustomToken(auth, data.token);
    },
    signOut: () => signOut(auth),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession fuera de SessionProvider');
  return s;
}
