// The workout being typed in (a "draft") and the rules for turning plans and
// past workouts into one, and a finished one into a saved workout. Ported
// from the website's Log form (app/src/routes/index.tsx) so both behave alike.
import type { TemplateExercise, TemplateLink, Workout, WorkoutExercise, WorkoutSet } from './types';
import {
  CARDIO_LABEL,
  CATEGORY_COLORS,
  NUM_SETS,
  OTHER_CATEGORY,
  OTHER_VALUE,
  uid,
  type CategoryInfo,
  type WorkoutUser,
} from './workout-data';
import { parseWeight } from './workout-helpers';

export type SetField = 'reps' | 'weight' | 'time' | 'intensity';

export type DraftSet = {
  id: string;
  reps: string;
  weight: string;
  time: string;
  intensity: string;
};

export type DraftExercise = {
  id: string;
  /** A known exercise name, OTHER_VALUE for "type your own", or "" when not chosen yet. */
  name: string;
  customName: string;
  customCategory: string;
  sets: DraftSet[];
  /** The partner's sets in Together Mode. */
  setsOther: DraftSet[];
  targetReps?: string;
  notes: string;
  /** Notes saved to the running notes list during this session. */
  sessionNotes?: string[];
};

export type SavedDraft = {
  date: string;
  exercises: DraftExercise[];
  togetherMode: boolean;
  savedAt: string;
  template?: TemplateLink | null;
};

export type ToCategory = Record<string, CategoryInfo>;

const blankSet = (): DraftSet => ({ id: uid(), reps: '', weight: '', time: '', intensity: '' });

export function makeSets(count: number = NUM_SETS): DraftSet[] {
  const n = Math.max(1, Math.min(count, NUM_SETS));
  return Array.from({ length: n }, blankSet);
}

/**
 * Cardio exercises always get exactly one set; everything else gets NUM_SETS.
 * Keeps what was already typed where possible instead of blanking it.
 */
export function clampSetsForCategory(sets: DraftSet[], isCardio: boolean): DraftSet[] {
  if (isCardio) return sets.length ? [sets[0]] : [blankSet()];
  if (sets.length >= NUM_SETS) return sets.slice(0, NUM_SETS);
  const padded = [...sets];
  while (padded.length < NUM_SETS) padded.push(blankSet());
  return padded;
}

export function emptyExercise(): DraftExercise {
  return {
    id: uid(),
    name: '',
    customName: '',
    customCategory: '',
    sets: makeSets(),
    setsOther: makeSets(),
    notes: '',
  };
}

export function templateToDraft(
  items: TemplateExercise[],
  toCategory: ToCategory,
): DraftExercise[] {
  if (!items.length) return [emptyExercise()];
  return items.map((t) => {
    const known = !!toCategory[t.name];
    const isCardio = toCategory[t.name]?.label === CARDIO_LABEL;
    const count = isCardio ? 1 : Math.max(1, t.sets);
    return {
      id: uid(),
      name: known ? t.name : OTHER_VALUE,
      customName: known ? '' : t.name,
      customCategory: '',
      sets: makeSets(count),
      setsOther: makeSets(count),
      targetReps: t.reps,
      notes: '',
    };
  });
}

export function workoutExercisesToDraft(
  exercises: WorkoutExercise[],
  toCategory: ToCategory,
): DraftExercise[] {
  if (!exercises.length) return [emptyExercise()];
  return exercises.map((ex) => {
    const cat = toCategory[ex.name];
    const known = !!cat;
    const isCardio =
      cat?.label === CARDIO_LABEL || (!known && ex.sets.some((s) => s.time || s.intensity));
    const rawSets: DraftSet[] = ex.sets.map((s) => ({
      id: uid(),
      reps: isCardio ? '' : String(s.reps),
      weight: isCardio ? '' : String(s.weight),
      time: isCardio ? String(s.time) : '',
      intensity: isCardio ? String(s.intensity) : '',
    }));
    const sets = clampSetsForCategory(rawSets, isCardio);
    return {
      id: uid(),
      name: known ? ex.name : OTHER_VALUE,
      customName: known ? '' : ex.name,
      customCategory: known ? '' : isCardio ? CARDIO_LABEL : '',
      sets,
      setsOther: makeSets(sets.length),
      notes: ex.notes || '',
    };
  });
}

/** Same exercises, every number and note cleared (used by "Repeat"). */
export function blankDraftSets(exercises: DraftExercise[]): DraftExercise[] {
  return exercises.map((ex) => ({
    ...ex,
    id: uid(),
    sets: ex.sets.map(blankSet),
    setsOther: ex.setsOther.map(blankSet),
    notes: '',
  }));
}

export function resolveCategory(ex: DraftExercise, toCategory: ToCategory): CategoryInfo | null {
  if (!ex.name) return null;
  if (ex.name === OTHER_VALUE) {
    if (!ex.customCategory) return OTHER_CATEGORY;
    return {
      label: ex.customCategory,
      color: CATEGORY_COLORS[ex.customCategory] ?? OTHER_CATEGORY.color,
    };
  }
  return toCategory[ex.name] || OTHER_CATEGORY;
}

export function finalName(ex: DraftExercise): string {
  return ex.name === OTHER_VALUE ? ex.customName.trim() : ex.name;
}

const setHasEntry = (s: DraftSet) => !!(s.reps || s.weight || s.time || s.intensity);

/** True when there is anything worth keeping (an exercise picked, a note, a number). */
export function draftHasContent(exercises: DraftExercise[]): boolean {
  return exercises.some(
    (ex) =>
      ex.name ||
      ex.customName.trim() ||
      ex.notes.trim() ||
      (ex.sessionNotes?.length ?? 0) > 0 ||
      [...ex.sets, ...ex.setsOther].some(setHasEntry),
  );
}

/** True when any reps, weight, time or intensity has been typed in. */
export function draftHasEntries(exercises: DraftExercise[]): boolean {
  return exercises.some((ex) => [...ex.sets, ...ex.setsOther].some(setHasEntry));
}

export function canSaveDraft(exercises: DraftExercise[], togetherMode: boolean): boolean {
  return exercises.some(
    (ex) =>
      finalName(ex) &&
      (ex.sets.some(setHasEntry) || (togetherMode && ex.setsOther.some(setHasEntry))),
  );
}

/** Whole numbers only (reps, minutes, intensity). Rejects anything else. */
export function sanitizeWholeNumberInput(raw: string, previous: string): string {
  return /^\d*$/.test(raw) ? raw : previous;
}

/** Intensity is 0-10. */
export function sanitizeIntensityInput(raw: string, previous: string): string {
  if (!/^\d*$/.test(raw)) return previous;
  if (raw !== '' && Number(raw) > 10) return previous;
  return raw;
}

export function cleanSets(sets: DraftSet[], isCardio: boolean): WorkoutSet[] {
  return isCardio
    ? sets
        .filter((s) => s.time !== '' || s.intensity !== '')
        .map((s) => ({
          reps: 0,
          weight: 0,
          time: Number(s.time) || 0,
          intensity: Number(s.intensity) || 0,
        }))
    : sets
        .filter((s) => s.reps !== '' || s.weight !== '')
        .map((s) => ({
          reps: Number(s.reps) || 0,
          weight: parseWeight(s.weight),
          time: 0,
          intensity: 0,
        }));
}

export type BuiltDraft = {
  exercises: WorkoutExercise[];
  /** The partner's workout (Together Mode only). */
  exercisesOther: WorkoutExercise[];
  /** New "type your own" exercises to remember for next time. */
  toRegister: { name: string; category: string }[];
  /** Typed-but-not-saved notes that should join the saved notes list. */
  notesToSave: { user: WorkoutUser; name: string; text: string }[];
};

/** Turns what was typed into the workout(s) that get saved. */
export function buildFromDraft(
  exercises: DraftExercise[],
  opts: {
    toCategory: ToCategory;
    togetherMode: boolean;
    /** True on the Log tab, where notes also go to the saved notes list. */
    withSavedNotes: boolean;
    currentUser: WorkoutUser;
    otherUser: WorkoutUser;
  },
): BuiltDraft {
  const out: BuiltDraft = { exercises: [], exercisesOther: [], toRegister: [], notesToSave: [] };
  for (const ex of exercises) {
    const name = finalName(ex);
    if (!name) continue;
    const isCardio = resolveCategory(ex, opts.toCategory)?.label === CARDIO_LABEL;
    const typed = ex.notes.trim();
    const workoutNotes = opts.withSavedNotes
      ? [...(ex.sessionNotes ?? []), typed].filter(Boolean).join('\n')
      : typed;
    const sets = cleanSets(ex.sets, isCardio);
    if (sets.length) {
      out.exercises.push({ name, sets, notes: workoutNotes });
      if (opts.withSavedNotes && typed) {
        out.notesToSave.push({ user: opts.currentUser, name, text: typed });
      }
    }
    if (opts.togetherMode) {
      const setsOther = cleanSets(ex.setsOther, isCardio);
      if (setsOther.length) {
        out.exercisesOther.push({ name, sets: setsOther, notes: workoutNotes });
        if (opts.withSavedNotes && typed) {
          out.notesToSave.push({ user: opts.otherUser, name, text: typed });
        }
      }
    }
    if (sets.length && ex.name === OTHER_VALUE) {
      out.toRegister.push({ name, category: ex.customCategory || OTHER_CATEGORY.label });
    }
  }
  return out;
}

/** Exercises of a plan as edited in the plan editor. */
export function draftToTemplateExercises(exercises: DraftExercise[]): TemplateExercise[] {
  return exercises
    .filter((ex) => finalName(ex))
    .map((ex) => ({ name: finalName(ex), sets: ex.sets.length, reps: ex.targetReps }));
}

/** A one-line summary of how an exercise went last time, e.g. "10×135lbs, 8×135lbs". */
export function lastWorkoutSummary(entry: WorkoutExercise | undefined, cardio: boolean): string {
  if (!entry?.sets.length) return '';
  return entry.sets
    .filter((s) => (cardio ? s.time || s.intensity : s.reps || s.weight))
    .map((s) => (cardio ? `${s.time}min @ ${s.intensity}/10` : `${s.reps}×${s.weight}lbs`))
    .join(', ');
}

export function isValidSavedDraft(d: unknown): d is SavedDraft {
  const draft = d as SavedDraft | null;
  return !!draft && Array.isArray(draft.exercises) && draft.exercises.length > 0;
}

export type { Workout };
