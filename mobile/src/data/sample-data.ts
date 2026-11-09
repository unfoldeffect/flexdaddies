// Sample data so the app has something to show on a new phone.
//
// EVERY NUMBER HERE IS MADE UP. Nothing is copied from the real Flex Daddies
// database. The five plans are the starter plans from the website's own
// database setup files (app/migrations), which are already public.
//
// Sample entries have ids starting with "sample-" so Settings can remove just
// them and keep anything logged on the phone.
import {
  BODY_PARTS,
  type BodyMeasurement,
  type Db,
  type ExerciseNote,
  type TemplateExercise,
  type WeighIn,
  type Workout,
  type WorkoutExercise,
  type WorkoutTemplate,
} from '../lib/types';
import { CARDIO_LABEL, EXERCISE_TO_CATEGORY, type WorkoutUser } from '../lib/workout-data';
import { toISODate } from '../lib/stats';

export const SAMPLE_PREFIX = 'sample-';

export const STARTER_PLANS: WorkoutTemplate[] = [
  {
    id: 'preset-upper-a',
    name: '1 - Upper A',
    createdBy: 'Diego',
    exercises: [
      { name: 'Chest Press Machine', sets: 3, reps: '8-10' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10' },
      { name: 'Lat Pulldown Machine', sets: 3, reps: '10-12' },
      { name: 'Shoulder Press Machine', sets: 3, reps: '10-12' },
      { name: 'Tricep Pushdown (Cable)', sets: 3, reps: '10-12' },
      { name: 'Bicep Curl Machine', sets: 3, reps: '10-12' },
      { name: 'Ab Crunch Machine', sets: 3, reps: '12-15' },
    ],
  },
  {
    id: 'preset-lower-a',
    name: '2 - Lower A',
    createdBy: 'Diego',
    exercises: [
      { name: 'Leg Press Machine', sets: 3, reps: '8-10' },
      { name: 'Leg Extension Machine', sets: 3, reps: '12-15' },
      { name: 'Seated Leg Curl Machine', sets: 3, reps: '10-12' },
      { name: 'Hip Thrust Machine', sets: 3, reps: '10-12' },
      { name: 'Seated Cable Row', sets: 3, reps: '8-10' },
      { name: 'Iso-Lateral Row Machine', sets: 3, reps: '10-12' },
      { name: 'Standing Calf Raise Machine', sets: 3, reps: '12-15' },
      { name: 'Cable Crunch', sets: 3, reps: '12-15' },
    ],
  },
  {
    id: 'preset-upper-b',
    name: '3 - Upper B',
    createdBy: 'Diego',
    exercises: [
      { name: 'Pec Deck Machine', sets: 3, reps: '12-15' },
      { name: 'Incline Chest Press Machine', sets: 3, reps: '8-10' },
      { name: 'Straight-Arm Pulldown', sets: 3, reps: '10-12' },
      { name: 'Rear Delt Fly Machine', sets: 3, reps: '12-15' },
      { name: 'Tricep Extension Machine', sets: 3, reps: '10-12' },
      { name: 'Hammer Curl', sets: 3, reps: '10-12' },
      { name: 'Torso Rotation Machine', sets: 3, reps: '12-15' },
    ],
  },
  {
    id: 'preset-lower-b',
    name: '4 - Lower B',
    createdBy: 'Diego',
    exercises: [
      { name: 'Hack Squat Machine', sets: 3, reps: '8-10' },
      { name: 'Lying Leg Curl Machine', sets: 3, reps: '10-12' },
      { name: 'Hip Abductor Machine', sets: 3, reps: '15-20' },
      { name: 'Glute Kickback Machine', sets: 3, reps: '12-15' },
      { name: 'T-Bar Row Machine', sets: 3, reps: '8-10' },
      { name: 'Seated Calf Raise Machine', sets: 3, reps: '15-20' },
      { name: 'Cable Woodchopper', sets: 3, reps: '12/side' },
    ],
  },
  {
    id: 'preset-trx-treadmill',
    name: '5 - Cardio + Rehab',
    createdBy: 'Diego',
    exercises: [
      { name: 'Stationary Bike', sets: 1, reps: '30 min, 125-140 bpm' },
      { name: 'Treadmill', sets: 1, reps: '10 min backward walk, slow, hold rails' },
      { name: 'TRX Row', sets: 3, reps: '12' },
      { name: 'TRX Y and T Raise', sets: 3, reps: '10 each' },
      { name: 'TRX Face Pull', sets: 3, reps: '12' },
    ],
  },
];

/** A small repeatable number from a name, so sample weights look varied but never change. */
function nameNumber(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973;
  return h;
}

function daysAgo(today: Date, n: number): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  d.setDate(d.getDate() - n);
  return d;
}

function sampleExercise(
  item: TemplateExercise,
  user: WorkoutUser,
  weekIndex: number,
): WorkoutExercise {
  const n = nameNumber(item.name);
  if (EXERCISE_TO_CATEGORY[item.name]?.label === CARDIO_LABEL) {
    const minutes = parseInt(item.reps ?? '', 10) || 20;
    return {
      name: item.name,
      sets: [{ reps: 0, weight: 0, time: minutes, intensity: 4 + (n % 4) }],
      notes: '',
    };
  }
  const bodyweight = item.name.startsWith('TRX');
  const lowReps = parseInt(item.reps ?? '', 10) || 10;
  const base = 40 + (n % 12) * 10 + (user === 'Kevin' ? 10 : 0);
  const weight = bodyweight ? 0 : base + weekIndex * 5;
  const sets = Array.from({ length: item.sets }, (_, i) => ({
    reps: Math.max(1, lowReps + 2 - i),
    weight,
    time: 0,
    intensity: 0,
  }));
  return { name: item.name, sets, notes: '' };
}

/** Builds the sample data, dated so it ends "today". */
export function buildSampleData(today: Date = new Date()): Db {
  const workouts: Workout[] = [];
  const WEEKS = 4;
  // Days-ago offsets within each week, and which starter plan was done.
  const schedule: { offset: number; plan: number; both: boolean }[] = [
    { offset: 6, plan: 0, both: true },
    { offset: 5, plan: 4, both: false },
    { offset: 4, plan: 1, both: true },
    { offset: 2, plan: 2, both: true },
    { offset: 1, plan: 3, both: true },
  ];
  for (let week = WEEKS - 1; week >= 0; week--) {
    const weekIndex = WEEKS - 1 - week;
    for (const slot of schedule) {
      const day = daysAgo(today, week * 7 + slot.offset);
      const plan = STARTER_PLANS[slot.plan];
      const users: WorkoutUser[] = slot.both ? ['Diego', 'Kevin'] : ['Diego'];
      for (const user of users) {
        const loggedAt = new Date(day);
        loggedAt.setHours(18, user === 'Diego' ? 5 : 6);
        workouts.push({
          id: `${SAMPLE_PREFIX}w-${week}-${slot.offset}-${user}`,
          user,
          date: toISODate(day),
          exercises: plan.exercises.map((item) => sampleExercise(item, user, weekIndex)),
          notes: '',
          loggedAt: loggedAt.toISOString(),
          template: { id: plan.id, name: plan.name },
        });
      }
    }
  }

  const weighIns: WeighIn[] = [];
  const startWeight: Record<WorkoutUser, number> = { Diego: 205, Kevin: 190 };
  const weeklyChange: Record<WorkoutUser, number> = { Diego: -0.8, Kevin: -0.5 };
  for (const user of ['Diego', 'Kevin'] as const) {
    for (let i = 0; i <= 5; i++) {
      const day = daysAgo(today, (5 - i) * 7);
      weighIns.push({
        id: `${SAMPLE_PREFIX}wi-${user}-${i}`,
        user,
        date: toISODate(day),
        weight: Math.round((startWeight[user] + weeklyChange[user] * i) * 10) / 10,
        loggedAt: day.toISOString(),
      });
    }
  }

  const measurements: BodyMeasurement[] = [];
  const startInches: Record<(typeof BODY_PARTS)[number], number> = {
    waist: 38,
    neck: 16,
    arms: 14.5,
    chest: 42,
    thighs: 24,
    hips: 40,
  };
  for (const user of ['Diego', 'Kevin'] as const) {
    BODY_PARTS.forEach((part, partIndex) => {
      for (let i = 0; i <= 2; i++) {
        const day = daysAgo(today, (2 - i) * 14);
        // Kevin's numbers move at a different pace so the two trend lines do not sit on top of each other.
        const pace = user === 'Kevin' ? (i === 1 ? 0.25 : 0.75) : 1;
        const change = (part === 'arms' || part === 'chest' ? 0.125 * i : -0.25 * i) * pace;
        measurements.push({
          id: `${SAMPLE_PREFIX}m-${user}-${part}-${i}`,
          user,
          date: toISODate(day),
          part,
          valueIn: startInches[part] + (user === 'Kevin' ? -1 : 0) + change,
          loggedAt: new Date(day.getTime() + partIndex * 1000).toISOString(),
        });
      }
    });
  }

  const noteDay = daysAgo(today, 8).toISOString();
  const exerciseNotes: ExerciseNote[] = [
    {
      id: `${SAMPLE_PREFIX}n-1`,
      user: 'Diego',
      exerciseName: 'Chest Press Machine',
      text: 'Seat height 4. Elbows tucked, slow on the way down.',
      createdAt: noteDay,
      updatedAt: noteDay,
    },
    {
      id: `${SAMPLE_PREFIX}n-2`,
      user: 'Kevin',
      exerciseName: 'Leg Press Machine',
      text: 'Feet a little higher on the plate.',
      createdAt: noteDay,
      updatedAt: noteDay,
    },
  ];

  return {
    workouts,
    weighIns,
    measurements,
    customExercises: [],
    templates: STARTER_PLANS,
    exerciseNotes,
    exerciseOverrides: [],
  };
}

const isSample = (item: { id: string }) => item.id.startsWith(SAMPLE_PREFIX);

export function hasSampleData(db: Db): boolean {
  return (
    db.workouts.some(isSample) ||
    db.weighIns.some(isSample) ||
    db.measurements.some(isSample) ||
    db.exerciseNotes.some(isSample)
  );
}

/** Removes the sample workouts, weigh-ins, measurements and notes. Plans and the exercise list stay. */
export function removeSampleData(db: Db): Db {
  return {
    ...db,
    workouts: db.workouts.filter((w) => !isSample(w)),
    weighIns: db.weighIns.filter((w) => !isSample(w)),
    measurements: db.measurements.filter((m) => !isSample(m)),
    exerciseNotes: db.exerciseNotes.filter((n) => !isSample(n)),
  };
}
