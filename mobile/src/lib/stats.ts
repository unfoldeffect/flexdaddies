// The maths behind History, Body and Stats. Ported from the website
// (app/src/routes/index.tsx) so the phone shows the same numbers.
import {
  BODY_PARTS,
  type BodyMeasurement,
  type BodyPart,
  type WeighIn,
  type Workout,
  type WorkoutExercise,
} from './types';
import { USERS, type WorkoutUser } from './workout-data';

export type WeightUnit = 'lbs' | 'kg';
export type LengthUnit = 'in' | 'cm';

export const LB_PER_KG = 2.20462262;
export const CM_PER_IN = 2.54;

export const lbsTo = (unit: WeightUnit, lbs: number) => (unit === 'kg' ? lbs / LB_PER_KG : lbs);
export const inchesTo = (unit: LengthUnit, inches: number) =>
  unit === 'cm' ? inches * CM_PER_IN : inches;

/** What was typed, converted to the lbs that get stored (one decimal). */
export function toStoredLbs(value: number, unit: WeightUnit): number {
  const lbs = unit === 'kg' ? value * LB_PER_KG : value;
  return Math.round(lbs * 10) / 10;
}

/** What was typed, converted to the inches that get stored (two decimals). */
export function toStoredInches(value: number, unit: LengthUnit): number {
  const inches = unit === 'cm' ? value / CM_PER_IN : value;
  return Math.round(inches * 100) / 100;
}

/** One decimal, without a trailing ".0". */
export function fmt1(n: number): string {
  return String(Number(n.toFixed(1)));
}

export function signed(n: number): string {
  const r = Number(n.toFixed(1));
  return `${r > 0 ? '+' : ''}${r}`;
}

/** Newest first: by workout date, then by when it was logged. */
export function sortWorkoutsNewestFirst(workouts: Workout[]): Workout[] {
  return [...workouts].sort(
    (a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime() ||
      (b.loggedAt || '').localeCompare(a.loggedAt || ''),
  );
}

/** For each exercise, how that person did it the most recent time. */
export function computeLastPerformance(
  workouts: Workout[],
  forUser: WorkoutUser | null,
): Record<string, WorkoutExercise> {
  const map: Record<string, WorkoutExercise> = {};
  if (!forUser) return map;
  const theirs = sortWorkoutsNewestFirst(workouts.filter((w) => w.user === forUser));
  for (const w of theirs) {
    for (const ex of w.exercises) {
      if (!(ex.name in map)) map[ex.name] = ex;
    }
  }
  return map;
}

export function workoutTotals(w: Workout): { sets: number; volume: number } {
  let sets = 0;
  let volume = 0;
  for (const ex of w.exercises) {
    sets += ex.sets.length;
    for (const s of ex.sets) volume += s.reps * s.weight;
  }
  return { sets, volume };
}

export type PersonalRecord = { name: string; weight: number; reps: number; date: string };

export type WorkoutStats = {
  total: number;
  thisWeek: number;
  perUser: Record<WorkoutUser, { count: number; volume: number }>;
  prs: Record<WorkoutUser, PersonalRecord[]>;
  volumeSeries: { date: string; total: number }[];
};

export function computeWorkoutStats(workouts: Workout[], now: Date = new Date()): WorkoutStats {
  const perUser = Object.fromEntries(USERS.map((u) => [u, { count: 0, volume: 0 }])) as Record<
    WorkoutUser,
    { count: number; volume: number }
  >;
  const prsByUser = Object.fromEntries(USERS.map((u) => [u, {}])) as Record<
    WorkoutUser,
    Record<string, PersonalRecord>
  >;
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let thisWeek = 0;
  const volumeByDate: Record<string, number> = {};

  for (const w of workouts) {
    if (perUser[w.user]) perUser[w.user].count += 1;
    if (new Date(w.date) >= weekAgo) thisWeek += 1;
    let dayTotal = 0;
    for (const ex of w.exercises) {
      const key = ex.name.trim().toLowerCase();
      for (const s of ex.sets) {
        const vol = s.reps * s.weight;
        if (perUser[w.user]) perUser[w.user].volume += vol;
        dayTotal += vol;
        const userPrs = prsByUser[w.user];
        if (userPrs && (!userPrs[key] || s.weight > userPrs[key].weight)) {
          userPrs[key] = { name: ex.name, weight: s.weight, reps: s.reps, date: w.date };
        }
      }
    }
    volumeByDate[w.date] = (volumeByDate[w.date] || 0) + dayTotal;
  }

  const prs = Object.fromEntries(
    USERS.map((u) => [
      u,
      Object.values(prsByUser[u])
        .filter((p) => p.weight > 0)
        .sort((a, b) => b.weight - a.weight),
    ]),
  ) as Record<WorkoutUser, PersonalRecord[]>;

  const volumeSeries = Object.entries(volumeByDate)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { total: workouts.length, thisWeek, perUser, prs, volumeSeries };
}

/** Each person's weigh-ins, newest first. */
export function weighInsByUser(weighIns: WeighIn[]): Record<WorkoutUser, WeighIn[]> {
  return Object.fromEntries(
    USERS.map((u) => [
      u,
      weighIns
        .filter((w) => w.user === u)
        .sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)),
    ]),
  ) as Record<WorkoutUser, WeighIn[]>;
}

export type WeightSummary = {
  latest: WeighIn | undefined;
  /** Latest minus the one before it, in lbs. */
  delta: number | null;
  /** Latest minus the very first, in lbs. */
  total: number | null;
  /** Oldest to newest, in lbs. */
  series: number[];
};

/** `list` must be newest first (see weighInsByUser). */
export function weightSummary(list: WeighIn[]): WeightSummary {
  const latest = list[0];
  const previous = list[1];
  const first = list[list.length - 1];
  return {
    latest,
    delta: latest && previous ? latest.weight - previous.weight : null,
    total: latest && first && list.length > 1 ? latest.weight - first.weight : null,
    series: [...list].reverse().map((w) => w.weight),
  };
}

/** Lbs lost from the first weigh-in to the latest (negative = gained). */
export function weightLoss(list: WeighIn[]): number | null {
  if (list.length < 2) return null;
  return list[list.length - 1].weight - list[0].weight;
}

export type MeasurementsByPart = Record<WorkoutUser, Record<BodyPart, BodyMeasurement[]>>;

/** Each person's measurements per body part, newest first. */
export function measurementsByPersonPart(measurements: BodyMeasurement[]): MeasurementsByPart {
  const out = {} as MeasurementsByPart;
  for (const u of USERS) {
    const map = {} as Record<BodyPart, BodyMeasurement[]>;
    for (const p of BODY_PARTS) {
      map[p] = measurements
        .filter((m) => m.user === u && m.part === p)
        .sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt));
    }
    out[u] = map;
  }
  return out;
}

/** Change across all six body parts, in inches (negative = lost). */
export function measurementTotals(
  byPart: Record<BodyPart, BodyMeasurement[]>,
): { sinceStart: number; sinceLast: number } | null {
  let sinceStart = 0;
  let sinceLast = 0;
  let any = false;
  for (const p of BODY_PARTS) {
    const list = byPart[p];
    if (list.length > 1) {
      any = true;
      sinceStart += list[0].valueIn - list[list.length - 1].valueIn;
      sinceLast += list[0].valueIn - list[1].valueIn;
    }
  }
  return any ? { sinceStart, sinceLast } : null;
}

export function lostLabel(changeIn: number, unit: LengthUnit): string {
  const v = inchesTo(unit, changeIn);
  if (Math.abs(v) < 0.05) return `0 ${unit}`;
  return v < 0 ? `${fmt1(-v)} ${unit} lost` : `${fmt1(v)} ${unit} gained`;
}

export function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDraftTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/** A "YYYY-MM-DD" string for a local calendar day. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The local calendar day for a "YYYY-MM-DD" string (noon, to stay clear of DST edges). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1, 12);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toISODate(fromISODate(iso)) === iso;
}
