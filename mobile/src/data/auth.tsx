// Who is signed in to the store app. The session is read from the phone at
// launch, so the app opens straight away with no signal (in a gym basement,
// say); the server is only asked in the background whether it still stands.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { apiBase, makeAuthApi, type Account, type ApiResult, type Session } from '../lib/auth-api';
import { clearSession, loadSession, saveSession } from './auth-storage';

export type Auth = {
  /** False until the saved session has been read at launch. */
  ready: boolean;
  session: Session | null;
  account: Account | null;
  /** Step 1: ask for a code. A test server hands the code back to show on screen. */
  startEmail: (email: string) => Promise<ApiResult<{ devCode?: string }>>;
  /** Step 2: the code signs this phone in. */
  verifyCode: (email: string, code: string) => Promise<ApiResult<{ isNew: boolean }>>;
  saveProfile: (patch: { name?: string; weightUnit?: 'lbs' | 'kg' }) => Promise<ApiResult<Account>>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<ApiResult<true>>;
};

const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const api = useMemo(() => makeAuthApi(apiBase()), []);
  const [ready, setReady] = useState(false);
  const [session, setSessionState] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const setSession = useCallback(async (next: Session | null) => {
    sessionRef.current = next;
    setSessionState(next);
    if (next) await saveSession(next);
    else await clearSession();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadSession();
      if (cancelled) return;
      sessionRef.current = saved;
      setSessionState(saved);
      setReady(true);
      if (!saved) return;
      // Still good? Only a clear "no" from the server signs the phone out;
      // being offline changes nothing.
      const check = await api.me(saved.token);
      if (cancelled || sessionRef.current?.token !== saved.token) return;
      if (check.ok) await setSession({ token: saved.token, account: check.data.user });
      else if (check.error === 'signed_out') await setSession(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, setSession]);

  const value = useMemo<Auth>(
    () => ({
      ready,
      session,
      account: session?.account ?? null,
      startEmail: async (email) => {
        const r = await api.start(email.trim());
        return r.ok ? { ok: true, data: { devCode: r.data.devCode } } : r;
      },
      verifyCode: async (email, code) => {
        const r = await api.verify(email.trim(), code);
        if (!r.ok) return r;
        await setSession({ token: r.data.token, account: r.data.user });
        return { ok: true, data: { isNew: r.data.isNew } };
      },
      saveProfile: async (patch) => {
        const current = sessionRef.current;
        if (!current) return { ok: false, error: 'signed_out', message: 'Sign in again.' };
        const r = await api.update(current.token, patch);
        if (!r.ok) {
          if (r.error === 'signed_out') await setSession(null);
          return r;
        }
        await setSession({ token: current.token, account: r.data.user });
        return { ok: true, data: r.data.user };
      },
      signOut: async () => {
        const current = sessionRef.current;
        await setSession(null);
        if (current) await api.signOut(current.token);
      },
      deleteAccount: async () => {
        const current = sessionRef.current;
        if (!current) return { ok: true, data: true };
        const r = await api.deleteAccount(current.token);
        // "Signed out" means the account is already gone from the server.
        if (!r.ok && r.error !== 'signed_out') return r;
        await setSession(null);
        return { ok: true, data: true };
      },
    }),
    [api, ready, session, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
