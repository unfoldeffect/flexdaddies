// Every change the app can make to its data, as plain functions:
// (data before, what to change) -> data after.
//
// Each one mirrors a server function on the website
// (app/src/lib/api/*.functions.ts) and follows the same rules, so the same
// calls can be pointed at the real backend later. Nothing here touches the
// network or the phone's storage; see store.tsx for that.
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
import type { WorkoutUser } from '../lib/workout-data';

const OTHER = 'Other';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

// ---------- Workouts ----------

export function createWorkout(db: Db, workout: Workout): Db {
  return { ...db, workouts: [workout, ...db.workouts] };
}

/** Only the person who logged a workout can change or delete it. */
export function updateWorkout(
  db: Db,
  input: { id: string; user: WorkoutUser; date: string; exercises: WorkoutExercise[]; notes: string },
): Db {
  return {
    ...db,
    workouts: db.workouts.map((w) =>
      w.id === input.id && w.user === input.user
        ? { ...w, date: input.date, exercises: input.exercises, notes: input.notes }
        : w,
    ),
  };
}

export function deleteWorkout(db: Db, input: { id: string; user: WorkoutUser }): Db {
  return {
    ...db,
    workouts: db.workouts.filter((w) => !(w.id === input.id && w.user === input.user)),
  };
}

// ---------- Weigh-ins ----------

export function createWeighIn(db: Db, entry: WeighIn): Db {
  return { ...db, weighIns: [entry, ...db.weighIns] };
}

export function deleteWeighIn(db: Db, input: { id: string; user: WorkoutUser }): Db {
  return {
    ...db,
    weighIns: db.weighIns.filter((w) => !(w.id === input.id && w.user === input.user)),
  };
}

// ---------- Body measurements ----------

export function createBodyMeasurement(db: Db, entry: BodyMeasurement): Db {
  return { ...db, measurements: [entry, ...db.measurements] };
}

export function deleteBodyMeasurement(db: Db, input: { id: string; user: WorkoutUser }): Db {
  return {
    ...db,
    measurements: db.measurements.filter((m) => !(m.id === input.id && m.user === input.user)),
  };
}

// ---------- Plans ----------

export function createTemplate(db: Db, template: WorkoutTemplate): Db {
  return { ...db, templates: [...db.templates, template].sort(byName) };
}

export function updateTemplate(
  db: Db,
  input: { id: string; name: string; exercises: TemplateExercise[] },
): Db {
  return {
    ...db,
    templates: db.templates
      .map((t) => (t.id === input.id ? { ...t, name: input.name, exercises: input.exercises } : t))
      .sort(byName),
  };
}

export function deleteTemplate(db: Db, input: { id: string }): Db {
  return { ...db, templates: db.templates.filter((t) => t.id !== input.id) };
}

// ---------- Saved notes ----------

export function addExerciseNote(db: Db, note: ExerciseNote): Db {
  return { ...db, exerciseNotes: [note, ...db.exerciseNotes] };
}

export function updateExerciseNote(
  db: Db,
  input: { id: string; text: string; updatedAt: string },
): Db {
  return {
    ...db,
    exerciseNotes: db.exerciseNotes.map((n) =>
      n.id === input.id ? { ...n, text: input.text, updatedAt: input.updatedAt } : n,
    ),
  };
}

export function deleteExerciseNote(db: Db, input: { id: string }): Db {
  return { ...db, exerciseNotes: db.exerciseNotes.filter((n) => n.id !== input.id) };
}

// ---------- The exercise list ----------

/**
 * Remembers a "type your own" exercise. A new name is added. One already
 * saved as "Other" takes a real category once one is picked. A real category
 * is never overwritten.
 */
export function addCustomExercise(db: Db, input: { name: string; category: string }): Db {
  const existing = db.customExercises.find((c) => c.name === input.name);
  if (!existing) {
    return {
      ...db,
      customExercises: [...db.customExercises, { name: input.name, category: input.category }].sort(
        byName,
      ),
    };
  }
  if (existing.category === OTHER && input.category !== OTHER) {
    return {
      ...db,
      customExercises: db.customExercises.map((c) =>
        c.name === input.name ? { ...c, category: input.category } : c,
      ),
    };
  }
  return db;
}

/** Renames an exercise in past workouts, plans and saved notes so history stays connected. */
export function renameEverywhere(db: Db, from: string, to: string): Db {
  if (from === to) return db;
  const swap = <T extends { name: string }>(list: T[]) =>
    list.some((e) => e.name === from)
      ? list.map((e) => (e.name === from ? { ...e, name: to } : e))
      : list;
  return {
    ...db,
    workouts: db.workouts.map((w) => {
      const exercises = swap(w.exercises);
      return exercises === w.exercises ? w : { ...w, exercises };
    }),
    templates: db.templates.map((t) => {
      const exercises = swap(t.exercises);
      return exercises === t.exercises ? t : { ...t, exercises };
    }),
    exerciseNotes: db.exerciseNotes.map((n) =>
      n.exerciseName === from ? { ...n, exerciseName: to } : n,
    ),
  };
}

/**
 * Renames or recategorises an exercise. Built-in exercises live in the app's
 * code, so changes to them are kept as "overrides" keyed by the original name.
 */
export function updateExercise(
  db: Db,
  input: { currentName: string; newName: string; category: string; builtinOriginal?: string },
): Db {
  let next: Db;
  if (input.builtinOriginal) {
    const original = input.builtinOriginal;
    next = {
      ...db,
      exerciseOverrides: [
        ...db.exerciseOverrides.filter((o) => o.originalName !== original),
        { originalName: original, name: input.newName, category: input.category, hidden: false },
      ],
    };
  } else {
    next = {
      ...db,
      customExercises: db.customExercises.map((c) =>
        c.name === input.currentName ? { name: input.newName, category: input.category } : c,
      ),
    };
  }
  return renameEverywhere(next, input.currentName, input.newName);
}

/** Takes an exercise off the list. Logged workouts with it are never touched. */
export function removeExercise(
  db: Db,
  input: { name: string; category: string; builtinOriginal?: string },
): Db {
  if (input.builtinOriginal) {
    const original = input.builtinOriginal;
    const existing = db.exerciseOverrides.find((o) => o.originalName === original);
    return {
      ...db,
      exerciseOverrides: existing
        ? db.exerciseOverrides.map((o) => (o.originalName === original ? { ...o, hidden: true } : o))
        : [
            ...db.exerciseOverrides,
            { originalName: original, name: input.name, category: input.category, hidden: true },
          ],
    };
  }
  return { ...db, customExercises: db.customExercises.filter((c) => c.name !== input.name) };
}

export function restoreExercise(db: Db, input: { builtinOriginal: string }): Db {
  return {
    ...db,
    exerciseOverrides: db.exerciseOverrides.map((o) =>
      o.originalName === input.builtinOriginal ? { ...o, hidden: false } : o,
    ),
  };
}
