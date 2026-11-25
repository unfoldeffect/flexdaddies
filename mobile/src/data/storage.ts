// Reads and writes the app's data on the phone itself (AsyncStorage: a small
// private store that belongs to this app and is removed if the app is deleted).
// Nothing here goes over the network.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidSavedDraft, type SavedDraft } from '../lib/draft';
import type { LengthUnit, WeightUnit } from '../lib/stats';
import { EMPTY_DB, type Db } from '../lib/types';
import type { WorkoutUser } from '../lib/workout-data';

const DB_KEY = 'fd-db-v1';
const PREFS_KEY = 'fd-prefs-v1';
const draftKey = (user: string) => `fd-draft-${user}`;
const OLD_USERS: Record<string, WorkoutUser> = { Diego: 'me', Kevin: 'partner' };
const OLD_DRAFT_USER: Record<WorkoutUser, string> = { me: 'Diego', partner: 'Kevin' };

export const REST_CHOICES = [30, 45, 60, 90, 120] as const;

/** Settings that belong to this phone, not to the shared data. */
export type Prefs = {
  /** Always the person signed in. Kept so older saved settings still load. */
  user: WorkoutUser;
  /** "Lift with a partner" in Settings: off for a new customer. */
  partnerOn: boolean;
  partnerName: string;
  /** Pro is unlocked. Until in-app purchase exists, only the test switch in Settings sets it. */
  pro: boolean;
  weightUnit: WeightUnit;
  lengthUnit: LengthUnit;
  restSeconds: number;
  restSound: boolean;
  /** Dark is the default look; light is the same layout on a light ground. */
  theme: 'dark' | 'light';
};

export const DEFAULT_PREFS: Prefs = {
  user: 'me',
  partnerOn: false,
  partnerName: '',
  pro: false,
  weightUnit: 'lbs',
  lengthUnit: 'in',
  restSeconds: 60,
  restSound: true,
  theme: 'dark',
};

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Fills in anything missing so older saved data keeps working after an update. */
export function normalizeDb(raw: unknown): Db | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Record<keyof Db, unknown>>;
  const list = <K extends keyof Db>(key: K): Db[K] =>
    (Array.isArray(r[key]) ? r[key] : EMPTY_DB[key]) as Db[K];
  // Earlier test builds labeled entries with two fixed names. Carry them over.
  const people = <T extends { user: WorkoutUser }>(items: T[]): T[] =>
    items.map((x) => {
      const old = OLD_USERS[x.user as string];
      return old ? { ...x, user: old } : x;
    });
  return {
    workouts: people(list('workouts')),
    weighIns: people(list('weighIns')),
    measurements: people(list('measurements')),
    customExercises: list('customExercises'),
    templates: list('templates'),
    exerciseNotes: people(list('exerciseNotes')),
    exerciseOverrides: list('exerciseOverrides'),
  };
}

export function normalizePrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Prefs>;
  return {
    user: 'me',
    partnerOn: r.partnerOn === true,
    partnerName: typeof r.partnerName === 'string' ? r.partnerName.slice(0, 40) : '',
    pro: r.pro === true,
    weightUnit: r.weightUnit === 'kg' ? 'kg' : 'lbs',
    lengthUnit: r.lengthUnit === 'cm' ? 'cm' : 'in',
    restSeconds: (REST_CHOICES as readonly unknown[]).includes(r.restSeconds)
      ? (r.restSeconds as number)
      : DEFAULT_PREFS.restSeconds,
    restSound: r.restSound !== false,
    theme: r.theme === 'light' ? 'light' : 'dark',
  };
}

export const loadDb = async (): Promise<Db | null> => normalizeDb(await readJson(DB_KEY));
export const saveDb = (db: Db): Promise<boolean> => writeJson(DB_KEY, db);

export const loadPrefs = async (): Promise<Prefs> => normalizePrefs(await readJson(PREFS_KEY));
export const savePrefs = (prefs: Prefs): Promise<boolean> => writeJson(PREFS_KEY, prefs);

export async function loadDraft(user: WorkoutUser): Promise<SavedDraft | null> {
  const raw = (await readJson(draftKey(user))) ?? (await readJson(draftKey(OLD_DRAFT_USER[user])));
  return isValidSavedDraft(raw) ? raw : null;
}

export const saveDraft = (user: WorkoutUser, draft: SavedDraft): Promise<boolean> =>
  writeJson(draftKey(user), draft);

export async function clearDraft(user: WorkoutUser): Promise<void> {
  try {
    await AsyncStorage.multiRemove([draftKey(user), draftKey(OLD_DRAFT_USER[user])]);
  } catch {
    // Nothing else to do.
  }
}
