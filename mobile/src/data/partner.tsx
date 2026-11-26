// Partner sync (Pro): linking two phones with an invite code, sending a
// session logged for both people to the partner's phone, and picking up
// sessions the partner sent. Works like the backup: it tries when the app
// opens, when it comes back to the front and right after a session is logged;
// with no connection, what is waiting to go out is kept and sent later.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { ApiResult } from '../lib/auth-api';
import { addReceived, toShare, type SharedSession } from '../lib/partner';
import type { Workout } from '../lib/types';
import { useAuth } from './auth';
import { useStore } from './store';

const LINK_KEY = 'fd-partner-v1';
const OUTBOX_KEY = 'fd-partner-outbox-v1';

type Saved = { accountId: string; name: string };

async function readJson<T>(key: string): Promise<T | null> {
  try {
    return JSON.parse((await AsyncStorage.getItem(key)) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
const writeJson = (key: string, value: unknown) =>
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});

export type Partner = {
  /** The linked partner's first name, or null when no phone is linked. */
  linkedWith: string | null;
  createInvite: () => Promise<ApiResult<{ code: string }>>;
  join: (code: string) => Promise<ApiResult<{ name: string }>>;
  unlink: () => Promise<ApiResult<true>>;
  /** Checks with the server now: is a phone linked, is anything waiting. */
  refresh: () => Promise<void>;
  /** Called after a Together Mode session is saved: sends it to the partner's phone. */
  share: (mine: Workout, theirs: Workout) => void;
};

const PartnerContext = createContext<Partner | null>(null);

export function usePartner(): Partner {
  const partner = useContext(PartnerContext);
  if (!partner) throw new Error('usePartner must be used inside <PartnerProvider>');
  return partner;
}

export function PartnerProvider({ children }: { children: React.ReactNode }) {
  const { session, api } = useAuth();
  const { ready, fullDb, replaceDb, setPrefs } = useStore();
  const token = session?.token ?? null;
  const accountId = session?.account.id ?? null;
  const [linkedWith, setLinkedWith] = useState<string | null>(null);

  const dbRef = useRef(fullDb);
  const replaceRef = useRef(replaceDb);
  useEffect(() => {
    dbRef.current = fullDb;
    replaceRef.current = replaceDb;
  }, [fullDb, replaceDb]);
  const busy = useRef(false);
  /** The same as linkedWith, readable inside sync without waiting for a redraw. */
  const linkedRef = useRef<string | null>(null);

  const setLink = useCallback(
    (name: string | null, adopt: boolean) => {
      linkedRef.current = name;
      setLinkedWith(name);
      if (name && accountId) {
        void writeJson(LINK_KEY, { accountId, name } satisfies Saved);
        // A fresh link switches the partner on, under their own first name.
        if (adopt) setPrefs({ partnerOn: true, partnerName: name });
      } else {
        void AsyncStorage.removeItem(LINK_KEY).catch(() => {});
      }
    },
    [accountId, setPrefs],
  );

  /** Sends what is waiting, then picks up what the partner sent. */
  const sync = useCallback(async () => {
    if (!token || !accountId || busy.current) return;
    busy.current = true;
    try {
      const outbox = (await readJson<{ accountId: string; session: SharedSession }[]>(OUTBOX_KEY)) ?? [];
      const left: typeof outbox = [];
      for (const item of outbox) {
        if (item.accountId !== accountId) continue;
        const sent = await api.partnerSend(token, item.session);
        // Kept for later only when the server could not be reached.
        if (!sent.ok && (sent.error === 'offline' || sent.error === 'server_error')) left.push(item);
      }
      if (left.length !== outbox.length) await writeJson(OUTBOX_KEY, left);

      const got = await api.partnerSessions(token);
      if (!got.ok) return;
      const name = got.data.partner?.name ?? null;
      const before = linkedRef.current;
      if (before !== name) setLink(name, !!name && before === null);
      if (got.data.sessions.length) {
        const next = addReceived(dbRef.current, got.data.sessions);
        if (next === dbRef.current || (await replaceRef.current(next))) {
          await api.partnerReceived(token, got.data.sessions.map((s) => s.id));
        }
      }
    } finally {
      busy.current = false;
    }
  }, [api, token, accountId, setLink]);

  useEffect(() => {
    if (!ready || !token || !accountId) return;
    let cancelled = false;
    void readJson<Saved>(LINK_KEY).then((saved) => {
      if (cancelled) return;
      // Shown straight away from what the phone remembers; the server has the last word.
      if (saved?.accountId === accountId) {
        linkedRef.current = saved.name;
        setLinkedWith(saved.name);
      } else {
        linkedRef.current = null;
        setLinkedWith(null);
      }
      void sync();
    });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [ready, token, accountId, sync]);

  const value = useMemo<Partner>(
    () => ({
      linkedWith: token ? linkedWith : null,
      refresh: sync,
      createInvite: async () => {
        if (!token) return { ok: false, error: 'signed_out', message: 'Sign in again.' };
        const r = await api.partnerInvite(token);
        return r.ok ? { ok: true, data: { code: r.data.code } } : r;
      },
      join: async (code) => {
        if (!token) return { ok: false, error: 'signed_out', message: 'Sign in again.' };
        const r = await api.partnerJoin(token, code);
        if (!r.ok) return r;
        const name = r.data.partner?.name ?? 'Your partner';
        setLink(name, true);
        void sync();
        return { ok: true, data: { name } };
      },
      unlink: async () => {
        if (!token) return { ok: false, error: 'signed_out', message: 'Sign in again.' };
        const r = await api.partnerUnlink(token);
        if (!r.ok) return r;
        setLink(null, false);
        await AsyncStorage.removeItem(OUTBOX_KEY).catch(() => {});
        return { ok: true, data: true };
      },
      share: (mine, theirs) => {
        if (!token || !accountId || !linkedWith) return;
        void (async () => {
          const outbox = (await readJson<unknown[]>(OUTBOX_KEY)) ?? [];
          await writeJson(OUTBOX_KEY, [...outbox, { accountId, session: toShare(mine, theirs) }]);
          void sync();
        })();
      },
    }),
    [api, token, accountId, linkedWith, setLink, sync],
  );

  return <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>;
}
