// Bringing a workout history in from Hevy or Strong (their CSV export files),
// and sending this app's own history out as a file. Pure logic: no files or
// screens here, so it can be tested on its own.
import { defaultEquipment, exerciseLabel, findMovement, type Equipment } from './movements';
import type { Workout, WorkoutExercise, WorkoutSet } from './types';

// ---------- Reading a CSV file ----------

/** Splits CSV text into rows of cells. Handles quotes, commas or semicolons, and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.slice(0, clean.search(/\r?\n|$/));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

// ---------- Matching their exercise names to ours ----------

const EQUIPMENT_WORDS: Record<string, Equipment> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  dumbbells: 'Dumbbell',
  'smith machine': 'Smith',
  smith: 'Smith',
  machine: 'Machine',
  cable: 'Cable',
};

/** Their name for a movement (lower case, without the equipment) and ours. */
const OTHER_NAMES: Record<string, string> = {
  'overhead press': 'Shoulder Press',
  'military press': 'Shoulder Press',
  'strict military press': 'Shoulder Press',
  'seated overhead press': 'Shoulder Press',
  'straight arm lat pulldown': 'Straight Arm Pulldown',
  'rear delt reverse fly': 'Rear Delt Fly',
  'reverse fly': 'Rear Delt Fly',
  'seated cable row': 'Seated Row',
  'seated cable row - v grip': 'Seated Row',
  'seated cable row - bar grip': 'Seated Row',
  'seated leg curl': 'Leg Curl',
  'lying leg curl': 'Leg Curl',
  'standing calf raise': 'Calf Raise',
  'seated calf raise': 'Calf Raise',
  'bulgarian split squat': 'Split Squat',
  'biceps curl': 'Bicep Curl',
  'skull crusher': 'Skullcrusher',
  'tricep pushdown': 'Triceps Pushdown',
  'triceps rope pushdown': 'Triceps Pushdown',
  'tricep kickback': 'Triceps Kickback',
  'push ups': 'Push Up',
  'pull ups': 'Pull Up',
  'sit ups': 'Sit Up',
  lunges: 'Lunge',
  'leg raises': 'Leg Raise',
  stairmaster: 'Stair Machine',
  'elliptical trainer': 'Elliptical',
  burpees: 'Burpee',
  'jumping jacks': 'Jumping Jack',
};

export type MatchedName = { name: string; equipment: Equipment | null; matched: boolean };

/**
 * "Bench Press (Barbell)" becomes our Bench Press on Barbell. Anything that
 * does not line up with one of our movements and its equipment keeps its own
 * name exactly, so nothing is lost or mislabeled.
 */
export function matchExercise(theirName: string): MatchedName {
  const original = theirName.replace(/\s+/g, ' ').trim();
  const parts = original.match(/^(.*?)\s*\(([^)]+)\)$/);
  const base = (parts ? parts[1] : original).trim();
  const tag = parts ? parts[2].trim().toLowerCase() : '';
  const ours = findMovement(OTHER_NAMES[base.toLowerCase()] ?? base);
  const kept: MatchedName = { name: original, equipment: null, matched: false };
  if (!ours) return kept;
  if (!tag) {
    const only = defaultEquipment(ours.name);
    // With several kinds of equipment to choose from and none named, do not guess.
    if (ours.equipment.length > 1) return kept;
    return { name: ours.name, equipment: only, matched: true };
  }
  if (tag === 'bodyweight') {
    return ours.equipment.length === 0 || ours.optionalEquipment
      ? { name: ours.name, equipment: null, matched: true }
      : kept;
  }
  const equipment = EQUIPMENT_WORDS[tag];
  if (equipment && ours.equipment.includes(equipment)) return { name: ours.name, equipment, matched: true };
  return kept;
}

// ---------- Turning their rows into our workouts ----------

export type ImportSource = 'Hevy' | 'Strong';
export type ImportUnit = 'lbs' | 'kg';

export type ImportResult = {
  source: ImportSource;
  workouts: Workout[];
  /** Exercise names kept as they were (not one of our 75 movements). */
  keptNames: string[];
  /** How many different exercises lined up with ours. */
  matchedCount: number;
  firstDate: string;
  lastDate: string;
  /** Strong files do not always say whether weights are lbs or kg: ask. */
  needsUnit: boolean;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const two = (n: number) => String(n).padStart(2, '0');

/** Reads "20 Nov 2026, 18:05" (Hevy) or "2026-11-20 18:05:11" (Strong). */
export function parseWhen(text: string): { date: string; time: string } | null {
  const s = text.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return { date: `${m[1]}-${two(+m[2])}-${two(+m[3])}`, time: `${two(+(m[4] ?? 12))}:${m[5] ?? '00'}` };
  m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})(?:,? (\d{1,2}):(\d{2}))?/);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase());
    if (month < 0) return null;
    return { date: `${m[3]}-${two(month + 1)}-${two(+m[1])}`, time: `${two(+(m[4] ?? 12))}:${m[5] ?? '00'}` };
  }
  return null;
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const num = (text: string | undefined) => {
  const n = Number((text ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const toLbs = (value: number, unit: ImportUnit) =>
  unit === 'kg' ? Math.round(value * 2.2046226 * 10) / 10 : Math.round(value * 100) / 100;

/** Says which app a file came from, by its header row, or null if it is neither. */
export function detectSource(header: string[]): ImportSource | null {
  const h = header.map((c) => c.trim().toLowerCase());
  if (h.includes('exercise_title') && h.includes('start_time')) return 'Hevy';
  if (h.includes('exercise name') && h.includes('workout name') && h.includes('date')) return 'Strong';
  return null;
}

export function importWorkouts(csvText: string, strongUnit: ImportUnit = 'lbs'): ImportResult | null {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return null;
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const source = detectSource(header);
  if (!source) return null;
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));

  const c =
    source === 'Hevy'
      ? {
          when: col('start_time'),
          title: col('title'),
          exercise: col('exercise_title'),
          lbs: col('weight_lbs'),
          kg: col('weight_kg'),
          reps: col('reps'),
          seconds: col('duration_seconds'),
          rpe: col('rpe'),
          notes: col('exercise_notes'),
        }
      : {
          when: col('date'),
          title: col('workout name'),
          exercise: col('exercise name'),
          lbs: col('weight', 'weight (lbs)', 'weight (lb)'),
          kg: col('weight (kg)'),
          reps: col('reps'),
          seconds: col('seconds', 'duration (sec)'),
          rpe: col('rpe'),
          notes: col('notes'),
        };
  const unitNamed = source === 'Hevy' || c.kg >= 0 || header.some((h) => /^weight \(lbs?\)$/.test(h));

  const byKey = new Map<string, Workout>();
  const names = new Map<string, MatchedName>();
  for (const row of rows.slice(1)) {
    const when = parseWhen(row[c.when] ?? '');
    const theirName = (row[c.exercise] ?? '').trim();
    if (!when || !theirName) continue;
    const title = (row[c.title] ?? '').trim();
    const key = `${source}|${when.date} ${when.time}|${title}`;
    let workout = byKey.get(key);
    if (!workout) {
      workout = {
        id: `imp-${hash(key)}`,
        user: 'me',
        date: when.date,
        exercises: [],
        notes: '',
        loggedAt: `${when.date}T${when.time}:00.000Z`,
        template: null,
      };
      byKey.set(key, workout);
    }
    const match = names.get(theirName) ?? matchExercise(theirName);
    names.set(theirName, match);
    let exercise = workout.exercises.find(
      (e) => e.name === match.name && (e.equipment ?? null) === match.equipment,
    );
    if (!exercise) {
      exercise = { name: match.name, equipment: match.equipment, sets: [], notes: '' };
      workout.exercises.push(exercise);
    }
    const note = (row[c.notes] ?? '').trim();
    if (note && !exercise.notes.includes(note)) exercise.notes = [exercise.notes, note].filter(Boolean).join(' ');

    const kg = c.kg >= 0 ? num(row[c.kg]) : 0;
    const plain = c.lbs >= 0 ? num(row[c.lbs]) : 0;
    const weight = kg ? toLbs(kg, 'kg') : toLbs(plain, source === 'Hevy' ? 'lbs' : strongUnit);
    const reps = Math.round(num(row[c.reps]));
    const seconds = c.seconds >= 0 ? num(row[c.seconds]) : 0;
    const rpe = c.rpe >= 0 ? Math.min(10, Math.round(num(row[c.rpe]))) : 0;
    if (!reps && !seconds) continue;
    const set: WorkoutSet = reps
      ? { reps, weight, time: 0, intensity: 0 }
      : { reps: 0, weight: 0, time: Math.max(1, Math.round(seconds / 60)), intensity: rpe };
    exercise.sets.push(set);
  }

  const workouts = [...byKey.values()]
    .map((w) => ({ ...w, exercises: w.exercises.filter((e) => e.sets.length > 0) }))
    .filter((w) => w.exercises.length > 0)
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  if (!workouts.length) return null;
  const used = new Set(workouts.flatMap((w) => w.exercises.map((e) => exerciseLabel(e.name, e.equipment))));
  const all = [...names.values()].filter((n) => used.has(exerciseLabel(n.name, n.equipment)));
  return {
    source,
    workouts,
    keptNames: [...new Set(all.filter((n) => !n.matched).map((n) => n.name))].sort(),
    matchedCount: new Set(all.filter((n) => n.matched).map((n) => exerciseLabel(n.name, n.equipment))).size,
    firstDate: workouts[0].date,
    lastDate: workouts[workouts.length - 1].date,
    needsUnit: !unitNamed,
  };
}

// ---------- Sending our workouts out ----------

const HEADER = [
  'title',
  'start_time',
  'end_time',
  'description',
  'exercise_title',
  'superset_id',
  'exercise_notes',
  'set_index',
  'set_type',
  'weight_lbs',
  'reps',
  'distance_miles',
  'duration_seconds',
  'rpe',
];
const quote = (value: string | number) => {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * One row per set, in the column layout Hevy uses, so the file opens in a
 * spreadsheet and in the tools and apps that already read Hevy files.
 */
export function exportCsv(workouts: Workout[]): string {
  const lines = [HEADER.join(',')];
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.loggedAt.localeCompare(b.loggedAt));
  for (const w of sorted) {
    const [y, m, d] = w.date.split('-').map(Number);
    const time = w.loggedAt.match(/T(\d{2}:\d{2})/)?.[1] ?? '12:00';
    const when = `${d} ${NAMES[m - 1]} ${y}, ${time}`;
    for (const ex of w.exercises as WorkoutExercise[]) {
      const title = ex.equipment ? `${ex.name} (${ex.equipment})` : ex.name;
      ex.sets.forEach((s, i) => {
        const cardio = s.reps === 0 && s.time > 0;
        lines.push(
          [
            w.template?.name ?? 'Workout',
            when,
            when,
            '',
            title,
            '',
            i === 0 ? ex.notes : '',
            i,
            'normal',
            cardio || !s.weight ? '' : s.weight,
            cardio ? '' : s.reps,
            '',
            cardio ? s.time * 60 : '',
            cardio && s.intensity ? s.intensity : '',
          ]
            .map(quote)
            .join(','),
        );
      });
    }
  }
  return lines.join('\n') + '\n';
}
