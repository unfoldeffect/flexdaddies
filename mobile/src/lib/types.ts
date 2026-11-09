// Data shapes. These match the website's server functions field for field
// (app/src/lib/api/*.functions.ts), so the phone's saved data can be sent to
// the same backend later without converting anything.
import type { WorkoutUser } from './workout-data';

export type { WorkoutUser };

export type WorkoutSet = { reps: number; weight: number; time: number; intensity: number };

export type WorkoutExercise = { name: string; sets: WorkoutSet[]; notes: string };

export type TemplateLink = { id: string; name: string };

export type Workout = {
  id: string;
  user: WorkoutUser;
  date: string;
  exercises: WorkoutExercise[];
  notes: string;
  loggedAt: string;
  /** Plan this workout was started from; null when logged from scratch. */
  template?: TemplateLink | null;
};

export type WeighIn = {
  id: string;
  user: WorkoutUser;
  date: string;
  /** Always stored in lbs. */
  weight: number;
  loggedAt: string;
};

export const BODY_PARTS = ['waist', 'neck', 'arms', 'chest', 'thighs', 'hips'] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  waist: 'Waist',
  neck: 'Neck',
  arms: 'Arms',
  chest: 'Chest',
  thighs: 'Thighs',
  hips: 'Hips',
};

export type BodyMeasurement = {
  id: string;
  user: WorkoutUser;
  date: string;
  part: BodyPart;
  /** Always stored in inches. */
  valueIn: number;
  loggedAt: string;
};

export type CustomExercise = { name: string; category: string };

export type ExerciseOverride = {
  originalName: string;
  name: string;
  category: string;
  hidden: boolean;
};

export type TemplateExercise = { name: string; sets: number; reps?: string };

export type WorkoutTemplate = {
  id: string;
  name: string;
  createdBy: string;
  exercises: TemplateExercise[];
};

export type ExerciseNote = {
  id: string;
  user: WorkoutUser;
  exerciseName: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

/** Everything the app stores, in one object. */
export type Db = {
  workouts: Workout[];
  weighIns: WeighIn[];
  measurements: BodyMeasurement[];
  customExercises: CustomExercise[];
  templates: WorkoutTemplate[];
  exerciseNotes: ExerciseNote[];
  exerciseOverrides: ExerciseOverride[];
};

export const EMPTY_DB: Db = {
  workouts: [],
  weighIns: [],
  measurements: [],
  customExercises: [],
  templates: [],
  exerciseNotes: [],
  exerciseOverrides: [],
};
