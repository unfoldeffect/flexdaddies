// The app's data, kept in memory while the app is open and saved to the phone
// after every change.
//
// Screens never write to storage themselves. They call the actions below,
// which are named after the website's server functions. To connect the real
// Flex Daddies backend later, only this file needs to change: each action
// would send the same data to the server instead of (or as well as) the phone.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type {
  BodyMeasurement,
  Db,
  ExerciseNote,
  TemplateExercise,
  WeighIn,
  Workout,
  WorkoutExercise,
  WorkoutTemplate,
} from '../lib/types';
import { EMPTY_DB } from '../lib/types';
import {
  OTHER_CATEGORY,
  USERS,
  mergeExerciseGroups,
  uid,
  type CategoryInfo,
  type ExerciseGroup,
  type ManagedExercise,
  type WorkoutUser,
} from '../lib/workout-data';
import * as ops from './db';
import { buildSampleData, hasSampleData, removeSampleData } from './sample-data';
import { DEFAULT_PREFS, loadDb, loadPrefs, saveDb, savePrefs, type Prefs } from './storage';

const SAVE_FAILED = "Couldn't save that to this phone. Check the phone has free space and try again.";

export type NotesApi = {
  notes: ExerciseNote[];
  add: (user: WorkoutUser, exerciseName: string, text: string) => Promise<boolean>;
  update: (id: string, text: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
};

export type Store = {
  /** False until saved data has been read from the phone at launch. */
  ready: boolean;
  db: Db;
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  user: WorkoutUser | null;
  otherUser: WorkoutUser | null;

  groups: ExerciseGroup[];
  toCategory: Record<string, CategoryInfo>;
  managed: ManagedExercise[];

  togetherMode: boolean;
  setTogetherMode: (on: boolean) => void;

  error: string | null;
  clearError: () => void;

  addWorkout: (workout: Workout) => Promise<boolean>;
  addWorkoutForBoth: (workout: Workout, workoutOther: Workout) => Promise<boolean>;
  editWorkout: (
    id: string,
    data: { date: string; exercises: WorkoutExercise[]; notes: string },
  ) => Promise<boolean>;
  removeWorkout: (id: string) => Promise<boolean>;

  addWeighIn: (entry: WeighIn) => Promise<boolean>;
  removeWeighIn: (id: string) => Promise<boolean>;
  addMeasurement: (entry: BodyMeasurement) => Promise<boolean>;
  removeMeasurement: (id: string) => Promise<boolean>;

  saveAsPlan: (workout: Workout, name: string) => Promise<boolean>;
  removeTemplate: (id: string) => Promise<boolean>;
  saveTemplateEdits: (id: string, name: string, exercises: TemplateExercise[]) => Promise<boolean>;
  savePlanOrder: (template: WorkoutTemplate, exercises: TemplateExercise[]) => Promise<boolean>;

  registerExercise: (name: string, category: string) => void;
  updateManagedExercise: (ex: ManagedExercise, newName: string, category: string) => Promise<boolean>;
  removeManagedExercise: (ex: ManagedExercise) => Promise<boolean>;
  restoreManagedExercise: (ex: ManagedExercise) => Promise<boolean>;

  notesApi: NotesApi;

  hasSample: boolean;
  removeSample: () => Promise<boolean>;
  resetToSample: () => Promise<boolean>;
  eraseEverything: () => Promise<boolean>;
};

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

export function StoreProvider({
  children,
  initialDb,
  initialPrefs,
}: {
  children: React.ReactNode;
  /** For tests: skip reading the phone's storage and start from this. */
  initialDb?: Db;
  initialPrefs?: Prefs;
}) {
  const preloaded = !!initialDb;
  const [ready, setReady] = useState(preloaded);
  const [db, setDb] = useState<Db>(initialDb ?? EMPTY_DB);
  const [prefs, setPrefsState] = useState<Prefs>(initialPrefs ?? DEFAULT_PREFS);
  const [togetherMode, setTogetherMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The newest data, readable inside actions without waiting for a re-render.
  const dbRef = useRef(db);
  const prefsRef = useRef(prefs);
  // Writes happen one after another so an older save can never land last.
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;
    (async () => {
      const [savedDb, savedPrefs] = await Promise.all([loadDb(), loadPrefs()]);
      if (cancelled) return;
      let startDb = savedDb;
      if (!startDb) {
        // First launch on this phone: start with the sample data.
        startDb = buildSampleData();
        await saveDb(startDb);
      }
      dbRef.current = startDb;
      prefsRef.current = savedPrefs;
      setDb(startDb);
      setPrefsState(savedPrefs);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [preloaded]);

  /** Applies a change, shows it straight away, and saves it. Undone if the save fails. */
  const commit = useCallback(async (change: (db: Db) => Db, failMessage = SAVE_FAILED) => {
    const before = dbRef.current;
    const next = change(before);
    if (next === before) return true;
    dbRef.current = next;
    setDb(next);
    setError(null);
    const write = writeQueue.current.then(() => saveDb(dbRef.current));
    writeQueue.current = write.catch(() => false);
    const ok = await write.catch(() => false);
    if (!ok) {
      // Only roll back if nothing newer has been applied on top.
      if (dbRef.current === next) {
        dbRef.current = before;
        setDb(before);
      }
      setError(failMessage);
    }
    return ok;
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefsState(next);
    void savePrefs(next);
  }, []);

  const user = prefs.user;
  const otherUser = user ? (USERS.find((u) => u !== user) ?? null) : null;

  const { groups, toCategory, managed } = useMemo(
    () => mergeExerciseGroups(db.customExercises, db.exerciseOverrides),
    [db.customExercises, db.exerciseOverrides],
  );

  const store = useMemo<Store>(() => {
    const me = () => prefsRef.current.user;

    return {
      ready,
      db,
      prefs,
      setPrefs,
      user,
      otherUser,
      groups,
      toCategory,
      managed,
      togetherMode,
      setTogetherMode,
      error,
      clearError: () => setError(null),

      addWorkout: (workout) => commit((d) => ops.createWorkout(d, workout)),
      addWorkoutForBoth: (workout, workoutOther) =>
        commit((d) => ops.createWorkout(ops.createWorkout(d, workoutOther), workout)),
      editWorkout: async (id, data) => {
        const who = me();
        if (!who) return false;
        return commit((d) => ops.updateWorkout(d, { id, user: who, ...data }));
      },
      removeWorkout: async (id) => {
        const who = me();
        if (!who) return false;
        return commit((d) => ops.deleteWorkout(d, { id, user: who }));
      },

      addWeighIn: (entry) => commit((d) => ops.createWeighIn(d, entry)),
      removeWeighIn: async (id) => {
        const who = me();
        if (!who) return false;
        return commit((d) => ops.deleteWeighIn(d, { id, user: who }));
      },
      addMeasurement: (entry) => commit((d) => ops.createBodyMeasurement(d, entry)),
      removeMeasurement: async (id) => {
        const who = me();
        if (!who) return false;
        return commit((d) => ops.deleteBodyMeasurement(d, { id, user: who }));
      },

      saveAsPlan: async (workout, name) => {
        const who = me();
        const trimmed = name.trim();
        if (!who || !trimmed) return false;
        const exercises: TemplateExercise[] = workout.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets.length,
        }));
        return commit((d) =>
          ops.createTemplate(d, { id: uid(), name: trimmed, createdBy: who, exercises }),
        );
      },
      removeTemplate: (id) => commit((d) => ops.deleteTemplate(d, { id })),
      saveTemplateEdits: (id, name, exercises) =>
        commit((d) => ops.updateTemplate(d, { id, name, exercises })),
      savePlanOrder: (template, exercises) =>
        commit((d) => ops.updateTemplate(d, { id: template.id, name: template.name, exercises })),

      registerExercise: (name, category) => {
        const trimmed = name.trim();
        if (!me() || !trimmed) return;
        const known = mergeExerciseGroups(
          dbRef.current.customExercises,
          dbRef.current.exerciseOverrides,
        ).toCategory;
        const alreadyKnown = Object.keys(known).some(
          (k) => k.toLowerCase() === trimmed.toLowerCase(),
        );
        if (alreadyKnown) {
          // One first saved as "Other" takes its real category once one is picked.
          const existing = dbRef.current.customExercises.find(
            (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
          );
          if (
            existing &&
            existing.category === OTHER_CATEGORY.label &&
            category !== OTHER_CATEGORY.label
          ) {
            void commit((d) => ops.addCustomExercise(d, { name: existing.name, category }));
          }
          return;
        }
        void commit((d) => ops.addCustomExercise(d, { name: trimmed, category }));
      },
      updateManagedExercise: (ex, newName, category) =>
        commit((d) =>
          ops.updateExercise(d, {
            currentName: ex.name,
            newName,
            category,
            builtinOriginal: ex.builtinOriginal,
          }),
        ),
      removeManagedExercise: (ex) =>
        commit((d) =>
          ops.removeExercise(d, {
            name: ex.name,
            category: ex.category,
            builtinOriginal: ex.builtinOriginal,
          }),
        ),
      restoreManagedExercise: async (ex) => {
        const original = ex.builtinOriginal;
        if (!original) return false;
        return commit((d) => ops.restoreExercise(d, { builtinOriginal: original }));
      },

      notesApi: {
        notes: db.exerciseNotes,
        add: (noteUser, exerciseName, text) => {
          const now = new Date().toISOString();
          return commit((d) =>
            ops.addExerciseNote(d, {
              id: uid(),
              user: noteUser,
              exerciseName,
              text,
              createdAt: now,
              updatedAt: now,
            }),
          );
        },
        update: (id, text) =>
          commit((d) =>
            ops.updateExerciseNote(d, { id, text, updatedAt: new Date().toISOString() }),
          ),
        remove: (id) => commit((d) => ops.deleteExerciseNote(d, { id })),
      },

      hasSample: hasSampleData(db),
      removeSample: () => commit(removeSampleData),
      resetToSample: () => commit(() => buildSampleData()),
      eraseEverything: () => commit(() => ({ ...EMPTY_DB })),
    };
  }, [
    ready,
    db,
    prefs,
    setPrefs,
    user,
    otherUser,
    groups,
    toCategory,
    managed,
    togetherMode,
    error,
    commit,
  ]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
