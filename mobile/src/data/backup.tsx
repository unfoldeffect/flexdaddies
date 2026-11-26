// Backs the phone's data up to the account, by itself: a few seconds after any
// change, when the app opens and when it comes back to the front. With no
// connection the app carries on and this catches up later. Signing in on a
// new phone brings everything back.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { mergeDb, planSync, type BackupStatus, type SavedCopy, type SyncMeta } from '../lib/backup';
import { EMPTY_DB, type Db } from '../lib/types';
import { useAuth } from './auth';
import { normalizeDb, readSyncedSettings, syncedSettings, type SyncedSettings } from './storage';
import { useStore } from './store';

const META_KEY = 'fd-sync-v1';
const SAVE_DELAY_MS = 2500;

async function loadMeta(): Promise<SyncMeta | null> {
  try {
    const m = JSON.parse((await AsyncStorage.getItem(META_KEY)) ?? 'null') as SyncMeta | null;
    return m && typeof m.accountId === 'string' && typeof m.rev === 'number' ? m : null;
  } catch {
    return null;
  }
}
const saveMeta = (meta: SyncMeta) => AsyncStorage.setItem(META_KEY, JSON.stringify(meta)).catch(() => {});
export const forgetBackup = () => AsyncStorage.removeItem(META_KEY).catch(() => {});

const StatusContext = createContext<BackupStatus>({ state: 'off' });
export const useBackupStatus = () => useContext(StatusContext);

export function BackupProvider({ children }: { children: React.ReactNode }) {
  const { session, api } = useAuth();
  const { ready, fullDb, replaceDb, prefs, setPrefs } = useStore();
  // The settings that travel with the account, as text so a change is easy to spot.
  const settingsText = JSON.stringify(syncedSettings(prefs));
  const [status, setStatus] = useState<BackupStatus>({ state: 'off' });

  const token = session?.token ?? null;
  const accountId = session?.account.id ?? null;
  const dbRef = useRef(fullDb);
  const metaRef = useRef<SyncMeta | null>(null);
  /** The data this code itself put on the phone or sent up: not a change to save. */
  const settled = useRef<Db | null>(null);
  const busy = useRef(false);
  const again = useRef<null | boolean>(null);
  const started = useRef(false);

  // The store hands out a fresh replaceDb with every change; keep the latest
  // in a ref so a change does not restart (and cancel) a save that is waiting.
  const replaceRef = useRef(replaceDb);
  const settingsRef = useRef(settingsText);
  const setPrefsRef = useRef(setPrefs);
  /** Settings this code itself applied or sent: not a change to save. */
  const settledSettings = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    dbRef.current = fullDb;
    replaceRef.current = replaceDb;
    settingsRef.current = settingsText;
    setPrefsRef.current = setPrefs;
  }, [fullDb, replaceDb, settingsText, setPrefs]);

  const setMeta = useCallback((meta: SyncMeta) => {
    metaRef.current = meta;
    void saveMeta(meta);
  }, []);

  const sync = useCallback(
    async (full: boolean) => {
      if (!token || !accountId) return;
      if (busy.current) {
        again.current = again.current || full;
        return;
      }
      busy.current = true;
      setStatus({ state: 'saving' });
      let ok = false;
      let off = false;
      try {
        let server: SavedCopy | null = null;
        let serverSettings: SyncedSettings | null = null;
        const readServer = (rev: number, data: unknown) => {
          serverSettings = data ? readSyncedSettings((data as { settings?: unknown }).settings) : null;
          return { rev, data: data ? normalizeDb(data) : null };
        };
        // Up to three rounds, in case another phone saves while this one is merging.
        for (let round = 0; round < 3 && !ok; round++) {
          const meta = metaRef.current;
          const mine = meta && meta.accountId === accountId ? meta : null;
          const local = dbRef.current;
          let step: ReturnType<typeof planSync>;
          if (server || full || !mine) {
            if (!server) {
              const got = await api.getData(token);
              if (!got.ok) {
                off = got.error === 'not_set_up';
                break;
              }
              server = readServer(got.data.rev, got.data.data);
            }
            step = planSync({ meta, accountId, local, server });
          } else {
            step = mine.dirty ? 'push' : 'none';
          }

          if (step === 'none') {
            if (!mine) setMeta({ accountId, rev: server?.rev ?? 0, dirty: false });
            ok = true;
          } else if (step === 'take' || step === 'clear') {
            const next = step === 'take' && server?.data ? server.data : { ...EMPTY_DB };
            settled.current = next;
            if (!(await replaceRef.current(next))) break;
            // A phone taking the saved copy takes its settings too.
            const taken = serverSettings as SyncedSettings | null;
            if (step === 'take' && taken) {
              settledSettings.current = JSON.stringify(taken);
              setPrefsRef.current(taken);
            }
            setMeta({ accountId, rev: server?.rev ?? 0, dirty: false });
            ok = true;
          } else {
            let sending = local;
            if (step === 'merge' && server?.data) {
              sending = mergeDb(local, server.data);
              settled.current = sending;
              if (!(await replaceRef.current(sending))) break;
            }
            const baseRev = server ? server.rev : (mine?.rev ?? 0);
            const sentSettings = settingsRef.current;
            const put = await api.putData(token, baseRev, { ...sending, settings: JSON.parse(sentSettings) });
            if (put.ok) {
              // Something typed while this was in flight still needs saving.
              const changedSince =
                (dbRef.current !== sending && dbRef.current !== local) || settingsRef.current !== sentSettings;
              if (!changedSince) {
                settled.current = dbRef.current;
                settledSettings.current = sentSettings;
              }
              setMeta({ accountId, rev: put.data.rev, dirty: changedSince });
              ok = !changedSince;
              server = null;
              full = false;
            } else if (put.error === 'newer_copy' && put.details) {
              const d = put.details as { rev?: number; data?: unknown };
              server = readServer(Number(d.rev) || 0, d.data);
              setMeta({ accountId, rev: mine?.rev ?? 0, dirty: true });
            } else {
              break;
            }
          }
        }
      } finally {
        busy.current = false;
        setStatus(off ? { state: 'off' } : ok ? { state: 'saved', at: Date.now() } : { state: 'waiting' });
        if (again.current !== null) {
          const wasFull = again.current;
          again.current = null;
          void sync(wasFull);
        }
      }
    },
    [api, token, accountId, setMeta],
  );

  // When signed in and the phone's data is loaded: check against the saved copy.
  useEffect(() => {
    if (!ready || !token) {
      started.current = false;
      return;
    }
    let cancelled = false;
    settled.current = dbRef.current;
    settledSettings.current = settingsRef.current;
    void loadMeta().then((meta) => {
      if (cancelled) return;
      metaRef.current = meta;
      started.current = true;
      // A change made in the instant before this ran still counts.
      if (dbRef.current !== settled.current && meta) metaRef.current = { ...meta, dirty: true };
      settled.current = dbRef.current;
      void sync(true);
    });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && started.current) void sync(true);
    });
    return () => {
      cancelled = true;
      sub.remove();
      // Signed out: a save that was waiting has nowhere to go.
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [ready, token, sync]);

  // Any change on the phone, to the data or to the settings: note it, then save a moment later.
  useEffect(() => {
    if (!started.current || !token || !accountId) return;
    if (fullDb === settled.current && settingsText === settledSettings.current) return;
    settled.current = fullDb;
    settledSettings.current = settingsText;
    // Remembered across restarts, so a change made with no connection is not forgotten.
    const meta = metaRef.current;
    if (meta && meta.accountId === accountId) setMeta({ ...meta, dirty: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void sync(false);
    }, SAVE_DELAY_MS);
  }, [fullDb, settingsText, token, accountId, sync, setMeta]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const shown: BackupStatus = ready && token ? status : { state: 'off' };
  return <StatusContext.Provider value={shown}>{children}</StatusContext.Provider>;
}
