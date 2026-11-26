// The maths behind the progress charts on the Stats tab: one exercise over
// time, estimated one-rep max, sets by body part, and how steady the weeks
// have been. Pure functions, so they can be tested on their own.
import { exerciseKey, exerciseLabel } from './movements';
import { toISODate } from './stats';
import type { Workout } from './types';
import type { WorkoutUser } from './workout-data';

export const RANGES = ['1M', '3M', '1Y', 'All'] as const;
export type Range = (typeof RANGES)[number];
/** What the free version shows. Pro can pick any range. */
export const FREE_RANGE: Range = '3M';
const RANGE_DAYS: Record<Range, number | null> = { '1M': 31, '3M': 92, '1Y': 366, All: null };
export const RANGE_WORDS: Record<Range, string> = {
  '1M': 'the last month',
  '3M': 'the last 3 months',
  '1Y': 'the last year',
  All: 'all time',
};

const DAY = 86400000;
const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};

/**
 * What one all-out rep would be, worked out from a set (the Epley formula).
 * Past 12 reps the guess gets too loose to chart, so those sets are left out.
 */
export function estimateOneRepMax(weight: number, reps: number): number | null {
  if (weight <= 0 || reps < 1 || reps > 12) return null;
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30));
}

export type TrackedExercise = {
  /** Movement plus equipment, the same key History and records use. */
  key: string;
  /** "Bench Press · Dumbbell" */
  label: string;
  name: string;
  /** How many days it was logged with a weight. */
  sessions: number;
};

/** Every exercise this person has lifted a weight on, most-logged first. */
export function trackedExercises(workouts: Workout[], user: WorkoutUser): TrackedExercise[] {
  const found = new Map<string, TrackedExercise & { days: Set<string> }>();
  for (const w of workouts) {
    if (w.user !== user) continue;
    for (const ex of w.exercises) {
      if (!ex.sets.some((s) => s.weight > 0 && s.reps > 0)) continue;
      const key = exerciseKey(ex.name, ex.equipment);
      const entry = found.get(key) ?? {
        key,
        label: exerciseLabel(ex.name, ex.equipment),
        name: ex.name,
        sessions: 0,
        days: new Set<string>(),
      };
      entry.days.add(w.date);
      entry.sessions = entry.days.size;
      found.set(key, entry);
    }
  }
  return [...found.values()]
    .map(({ key, label, name, sessions }) => ({ key, label, name, sessions }))
    .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label));
}

export type ProgressPoint = {
  date: string;
  /** The heaviest weight lifted that day, and the reps done with it. */
  topWeight: number;
  topReps: number;
  /** The best estimated one-rep max from that day's sets, if any set allows a fair guess. */
  oneRepMax: number | null;
};

/** One point per day the exercise was done, oldest first. */
export function exerciseProgress(workouts: Workout[], user: WorkoutUser, key: string): ProgressPoint[] {
  const byDate = new Map<string, ProgressPoint>();
  for (const w of workouts) {
    if (w.user !== user) continue;
    for (const ex of w.exercises) {
      if (exerciseKey(ex.name, ex.equipment) !== key) continue;
      for (const s of ex.sets) {
        if (s.weight <= 0 || s.reps <= 0) continue;
        const p = byDate.get(w.date) ?? { date: w.date, topWeight: 0, topReps: 0, oneRepMax: null };
        if (s.weight > p.topWeight || (s.weight === p.topWeight && s.reps > p.topReps)) {
          p.topWeight = s.weight;
          p.topReps = s.reps;
        }
        const guess = estimateOneRepMax(s.weight, s.reps);
        if (guess !== null && (p.oneRepMax === null || guess > p.oneRepMax)) p.oneRepMax = guess;
        byDate.set(w.date, p);
      }
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Keeps the points that fall inside the range, counted back from today. */
export function inRange<T extends { date: string }>(points: T[], range: Range, now: Date = new Date()): T[] {
  const days = RANGE_DAYS[range];
  if (days === null) return points;
  const today = dayNumber(toISODate(now));
  return points.filter((p) => today - dayNumber(p.date) < days && dayNumber(p.date) <= today);
}

export type BodyPartSets = {
  label: string;
  color: string;
  /** Sets in the last 7 days. */
  thisWeek: number;
  /** Average sets per week over the 4 weeks before that. */
  usual: number;
};

/** Sets per body part: the last 7 days against the 4 weeks before. */
export function setsByBodyPart(
  workouts: Workout[],
  user: WorkoutUser,
  categoryOf: (exerciseName: string) => { label: string; color: string },
  now: Date = new Date(),
): BodyPartSets[] {
  const today = dayNumber(toISODate(now));
  const parts = new Map<string, BodyPartSets & { before: number }>();
  for (const w of workouts) {
    if (w.user !== user) continue;
    const ago = today - dayNumber(w.date);
    if (ago < 0 || ago >= 35) continue;
    for (const ex of w.exercises) {
      const done = ex.sets.filter((s) => s.reps > 0 || s.time > 0).length;
      if (!done) continue;
      const cat = categoryOf(ex.name);
      const part = parts.get(cat.label) ?? { label: cat.label, color: cat.color, thisWeek: 0, usual: 0, before: 0 };
      if (ago < 7) part.thisWeek += done;
      else part.before += done;
      parts.set(cat.label, part);
    }
  }
  return [...parts.values()]
    .map(({ before, ...p }) => ({ ...p, usual: Math.round((before / 4) * 10) / 10 }))
    .sort((a, b) => b.thisWeek - a.thisWeek || b.usual - a.usual || a.label.localeCompare(b.label));
}

export type Consistency = {
  /** Workouts in each of the last 12 weeks, oldest first; the last one is the 7 days ending today. */
  weeks: number[];
  /** Weeks in a row with at least one workout. A quiet current week does not break it yet. */
  streak: number;
  /** Average workouts per week over those 12 weeks. */
  perWeek: number;
};

export function consistency(workouts: Workout[], user: WorkoutUser, now: Date = new Date(), span = 12): Consistency {
  const today = dayNumber(toISODate(now));
  const all = new Map<number, Set<string>>();
  for (const w of workouts) {
    if (w.user !== user) continue;
    const ago = today - dayNumber(w.date);
    if (ago < 0) continue;
    const week = Math.floor(ago / 7);
    all.set(week, (all.get(week) ?? new Set()).add(w.date));
  }
  const count = (week: number) => all.get(week)?.size ?? 0;
  const weeks = Array.from({ length: span }, (_, i) => count(span - 1 - i));
  let streak = 0;
  for (let week = count(0) ? 0 : 1; count(week) > 0; week++) streak++;
  const total = weeks.reduce((a, b) => a + b, 0);
  return { weeks, streak, perWeek: Math.round((total / span) * 10) / 10 };
}
