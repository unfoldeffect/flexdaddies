// Reads and writes the app's data on the phone itself (AsyncStorage: a small
// private store that belongs to this app and is removed if the app is deleted).
// Nothing here goes over the network.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidSavedDraft, type SavedDraft } from '../lib/draft';
import type { LengthUnit, WeightUnit } from '../lib/stats';
import { EMPTY_DB, type Db } from '../lib/types';
import { USERS, type WorkoutUser } from '../lib/workout-data';

const DB_KEY = 'fd-db-v1';
const PREFS_KEY = 'fd-prefs-v1';
const draftKey = (user: WorkoutUser) => `fd-draft-${user}`;

export const REST_CHOICES = [30, 45, 60, 90, 120] as const;

/** Settings that belong to this phone, not to the shared data. */
export type Prefs = {
  /** Who is using this phone (null shows the "Who's lifting today?" screen). */
  user: WorkoutUser | null;
  weightUnit: WeightUnit;
  lengthUnit: LengthUnit;
  restSeconds: number;
  restSound: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  user: null,
  weightUnit: 'lbs',
  lengthUnit: 'in',
  restSeconds: 60,
  restSound: true,
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
  return {
    workouts: list('workouts'),
    weighIns: list('weighIns'),
    measurements: list('measurements'),
    customExercises: list('customExercises'),
    templates: list('templates'),
    exerciseNotes: list('exerciseNotes'),
    exerciseOverrides: list('exerciseOverrides'),
  };
}

export function normalizePrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Prefs>;
  return {
    user: (USERS as readonly unknown[]).includes(r.user) ? (r.user as WorkoutUser) : null,
    weightUnit: r.weightUnit === 'kg' ? 'kg' : 'lbs',
    lengthUnit: r.lengthUnit === 'cm' ? 'cm' : 'in',
    restSeconds: (REST_CHOICES as readonly unknown[]).includes(r.restSeconds)
      ? (r.restSeconds as number)
      : DEFAULT_PREFS.restSeconds,
    restSound: r.restSound !== false,
  };
}

export const loadDb = async (): Promise<Db | null> => normalizeDb(await readJson(DB_KEY));
export const saveDb = (db: Db): Promise<boolean> => writeJson(DB_KEY, db);

export const loadPrefs = async (): Promise<Prefs> => normalizePrefs(await readJson(PREFS_KEY));
export const savePrefs = (prefs: Prefs): Promise<boolean> => writeJson(PREFS_KEY, prefs);

export async function loadDraft(user: WorkoutUser): Promise<SavedDraft | null> {
  const raw = await readJson(draftKey(user));
  return isValidSavedDraft(raw) ? raw : null;
}

export const saveDraft = (user: WorkoutUser, draft: SavedDraft): Promise<boolean> =>
  writeJson(draftKey(user), draft);

export async function clearDraft(user: WorkoutUser): Promise<void> {
  try {
    await AsyncStorage.removeItem(draftKey(user));
  } catch {
    // Nothing else to do.
  }
}
