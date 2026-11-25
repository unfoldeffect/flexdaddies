// The store app's exercise list: one entry per movement (75), grouped.
// Equipment is picked when logging; each movement offers only the equipment
// that fits it. An empty list means no equipment step (bodyweight, cardio).
// "optionalEquipment": the choice starts off; tapping it records the assisted
// machine (Chest Dip, Pull Up, Triceps Dip). The store app no longer copies the
// website's exercise list (app/src/lib/workout-data.ts).

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Smith', 'Machine', 'Cable'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export type Movement = {
  name: string;
  group: string;
  equipment: Equipment[];
  /** True when "no equipment" is the default and the one choice is optional. */
  optionalEquipment?: boolean;
};

export type MovementGroup = { label: string; color: string; movements: Movement[] };

export const MOVEMENT_GROUPS: MovementGroup[] = [
  {
    label: 'Chest',
    color: '#2563eb',
    movements: [
      { name: 'Bench Press', group: 'Chest', equipment: ['Barbell', 'Dumbbell', 'Smith', 'Machine'] },
      { name: 'Incline Bench Press', group: 'Chest', equipment: ['Barbell', 'Dumbbell', 'Smith', 'Machine'] },
      { name: 'Decline Bench Press', group: 'Chest', equipment: ['Barbell', 'Dumbbell', 'Machine'] },
      { name: 'Chest Fly', group: 'Chest', equipment: ['Dumbbell', 'Machine', 'Cable'] },
      { name: 'Chest Dip', group: 'Chest', equipment: ['Machine'], optionalEquipment: true },
      { name: 'Push Up', group: 'Chest', equipment: [] },
      { name: 'Pullover', group: 'Chest', equipment: ['Dumbbell'] },
    ],
  },
  {
    label: 'Back',
    color: '#7c3aed',
    movements: [
      { name: 'Deadlift', group: 'Back', equipment: ['Barbell', 'Dumbbell'] },
      { name: 'Bent Over Row', group: 'Back', equipment: ['Barbell', 'Dumbbell', 'Machine'] },
      { name: 'Seated Row', group: 'Back', equipment: ['Machine', 'Cable'] },
      { name: 'Chest Supported Row', group: 'Back', equipment: ['Dumbbell', 'Machine'] },
      { name: 'Lat Pulldown', group: 'Back', equipment: ['Machine', 'Cable'] },
      { name: 'Straight Arm Pulldown', group: 'Back', equipment: ['Cable'] },
      { name: 'Pull Up', group: 'Back', equipment: ['Machine'], optionalEquipment: true },
      { name: 'Back Extension', group: 'Back', equipment: ['Machine'] },
    ],
  },
  {
    label: 'Shoulders',
    color: '#0d9488',
    movements: [
      { name: 'Shoulder Press', group: 'Shoulders', equipment: ['Barbell', 'Dumbbell', 'Smith', 'Machine'] },
      { name: 'Arnold Press', group: 'Shoulders', equipment: ['Dumbbell'] },
      { name: 'Lateral Raise', group: 'Shoulders', equipment: ['Dumbbell', 'Machine', 'Cable'] },
      { name: 'Front Raise', group: 'Shoulders', equipment: ['Dumbbell', 'Cable'] },
      { name: 'Rear Delt Fly', group: 'Shoulders', equipment: ['Dumbbell', 'Machine', 'Cable'] },
      { name: 'Face Pull', group: 'Shoulders', equipment: ['Cable'] },
      { name: 'Upright Row', group: 'Shoulders', equipment: ['Barbell', 'Dumbbell', 'Cable'] },
      { name: 'Shrug', group: 'Shoulders', equipment: ['Barbell', 'Dumbbell', 'Machine'] },
    ],
  },
  {
    label: 'Biceps',
    color: '#dc2626',
    movements: [
      { name: 'Bicep Curl', group: 'Biceps', equipment: ['Barbell', 'Dumbbell', 'Machine', 'Cable'] },
      { name: 'Hammer Curl', group: 'Biceps', equipment: ['Dumbbell', 'Cable'] },
      { name: 'Preacher Curl', group: 'Biceps', equipment: ['Barbell', 'Dumbbell', 'Machine'] },
      { name: 'Concentration Curl', group: 'Biceps', equipment: ['Dumbbell'] },
    ],
  },
  {
    label: 'Triceps',
    color: '#c2410c',
    movements: [
      { name: 'Triceps Pushdown', group: 'Triceps', equipment: ['Cable'] },
      { name: 'Overhead Triceps Extension', group: 'Triceps', equipment: ['Dumbbell', 'Machine', 'Cable'] },
      { name: 'Skullcrusher', group: 'Triceps', equipment: ['Barbell', 'Dumbbell'] },
      { name: 'Triceps Kickback', group: 'Triceps', equipment: ['Dumbbell', 'Cable'] },
      { name: 'Triceps Dip', group: 'Triceps', equipment: ['Machine'], optionalEquipment: true },
    ],
  },
  {
    label: 'Legs',
    color: '#b45309',
    movements: [
      { name: 'Squat', group: 'Legs', equipment: ['Barbell', 'Dumbbell', 'Smith', 'Machine'] },
      { name: 'Leg Press', group: 'Legs', equipment: ['Machine'] },
      { name: 'Leg Extension', group: 'Legs', equipment: ['Machine'] },
      { name: 'Leg Curl', group: 'Legs', equipment: ['Machine'] },
      { name: 'Romanian Deadlift', group: 'Legs', equipment: ['Barbell', 'Dumbbell', 'Cable'] },
      { name: 'Lunge', group: 'Legs', equipment: ['Barbell', 'Dumbbell'] },
      { name: 'Split Squat', group: 'Legs', equipment: ['Dumbbell'] },
      { name: 'Step Up', group: 'Legs', equipment: ['Dumbbell'] },
      { name: 'Wall Sit', group: 'Legs', equipment: [] },
      { name: 'Hip Thrust', group: 'Legs', equipment: ['Barbell', 'Machine'] },
      { name: 'Glute Kickback', group: 'Legs', equipment: ['Machine', 'Cable'] },
      { name: 'Hip Abduction', group: 'Legs', equipment: ['Machine'] },
      { name: 'Hip Adduction', group: 'Legs', equipment: ['Machine'] },
      { name: 'Calf Raise', group: 'Legs', equipment: ['Dumbbell', 'Machine'] },
    ],
  },
  {
    label: 'Core',
    color: '#16a34a',
    movements: [
      { name: 'Crunch', group: 'Core', equipment: ['Machine', 'Cable'] },
      { name: 'Bicycle Crunch', group: 'Core', equipment: [] },
      { name: 'Reverse Crunch', group: 'Core', equipment: [] },
      { name: 'Sit Up', group: 'Core', equipment: [] },
      { name: 'Leg Raise', group: 'Core', equipment: [] },
      { name: 'Flutter Kicks', group: 'Core', equipment: [] },
      { name: 'Plank', group: 'Core', equipment: [] },
      { name: 'Side Plank', group: 'Core', equipment: [] },
      { name: 'Ab Wheel', group: 'Core', equipment: [] },
      { name: 'Mountain Climber', group: 'Core', equipment: [] },
      { name: 'Dead Bug', group: 'Core', equipment: [] },
      { name: 'Bird Dog', group: 'Core', equipment: [] },
      { name: 'Russian Twist', group: 'Core', equipment: [] },
      { name: 'Cable Twist', group: 'Core', equipment: ['Cable'] },
      { name: 'Side Bend', group: 'Core', equipment: ['Dumbbell'] },
    ],
  },
  {
    label: 'Cardio',
    color: '#db2777',
    movements: [
      { name: 'Treadmill', group: 'Cardio', equipment: [] },
      { name: 'Elliptical', group: 'Cardio', equipment: [] },
      { name: 'Stair Machine', group: 'Cardio', equipment: [] },
      { name: 'Rowing Machine', group: 'Cardio', equipment: [] },
      { name: 'Bike', group: 'Cardio', equipment: [] },
      { name: 'Jump Rope', group: 'Cardio', equipment: [] },
      { name: 'Jumping Jack', group: 'Cardio', equipment: [] },
      { name: 'Burpee', group: 'Cardio', equipment: [] },
      { name: 'HIIT', group: 'Cardio', equipment: [] },
      { name: 'Kettlebell Swing', group: 'Cardio', equipment: [] },
      { name: 'Farmers Walk', group: 'Cardio', equipment: ['Dumbbell'] },
      { name: 'Warm Up', group: 'Cardio', equipment: [] },
      { name: 'Stretching', group: 'Cardio', equipment: [] },
      { name: 'Yoga', group: 'Cardio', equipment: [] },
    ],
  },
];

export const MOVEMENTS: Movement[] = MOVEMENT_GROUPS.flatMap((g) => g.movements);

const BY_NAME = new Map(MOVEMENTS.map((m) => [m.name.toLowerCase(), m]));

export function findMovement(name: string): Movement | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

export function isEquipment(value: unknown): value is Equipment {
  return typeof value === 'string' && (EQUIPMENT as readonly string[]).includes(value);
}

/**
 * The equipment to start with when a movement is picked:
 * - no equipment list: none
 * - what was used last time, when it still fits
 * - otherwise the only choice (unless it is optional, like the assisted machine)
 * - otherwise none yet: the person picks one the first time
 */
export function defaultEquipment(name: string, lastUsed?: Equipment | null): Equipment | null {
  const m = findMovement(name);
  if (!m || m.equipment.length === 0) return null;
  if (lastUsed && m.equipment.includes(lastUsed)) return lastUsed;
  if (m.optionalEquipment) return null;
  if (m.equipment.length === 1) return m.equipment[0];
  return null;
}

/** Key for "this movement on this equipment", used for last time, records and charts. */
export function exerciseKey(name: string, equipment?: Equipment | null): string {
  return equipment ? `${name}|${equipment}` : name;
}

/** "Bench Press · Dumbbell", or just the name. */
export function exerciseLabel(name: string, equipment?: Equipment | null): string {
  return equipment ? `${name} · ${equipment}` : name;
}
