export const USERS = ["Diego", "Kevin"] as const;
export type WorkoutUser = (typeof USERS)[number];

export const USER_COLORS: Record<WorkoutUser, string> = {
  Diego: "#2555c7",
  Kevin: "#b5651d",
};

export const OTHER_VALUE = "__other__";
export const NUM_SETS = 3;

export type ExerciseGroup = { label: string; color: string; options: string[] };

export const EXERCISE_GROUPS: ExerciseGroup[] = [
  {
    label: "Chest",
    color: "#2563eb",
    options: [
      "Barbell Bench Press",
      "Incline Barbell Bench Press",
      "Decline Barbell Bench Press",
      "Dumbbell Bench Press",
      "Incline Dumbbell Press",
      "Dumbbell Fly",
      "Cable Fly / Crossover",
      "Pec Deck Machine",
      "Chest Press Machine",
      "Incline Chest Press Machine",
      "Smith Machine Bench Press",
      "Push-Ups",
      "Chest Dips",
      "Assisted Dip Machine",
    ],
  },
  {
    label: "Back",
    color: "#7c3aed",
    options: [
      "Lat Pulldown Machine",
      "Assisted Pull-Up Machine",
      "Pull-Ups",
      "Chin-Ups",
      "Seated Cable Row",
      "T-Bar Row Machine",
      "Barbell Bent-Over Row",
      "Dumbbell One-Arm Row",
      "Iso-Lateral Row Machine",
      "Smith Machine Row",
      "Reverse Pec Deck (Rear Delt)",
      "Cable Face Pull",
      "Straight-Arm Pulldown",
      "Deadlift",
      "Trap Bar Deadlift",
      "Back Extension (Roman Chair)",
    ],
  },
  {
    label: "Legs",
    color: "#b45309",
    options: [
      "Barbell Back Squat",
      "Barbell Front Squat",
      "Smith Machine Squat",
      "Pendulum Squat Machine",
      "Hack Squat Machine",
      "Belt Squat Machine",
      "Leg Press Machine",
      "Vertical Leg Press Machine",
      "Leg Extension Machine",
      "Seated Leg Curl Machine",
      "Lying Leg Curl Machine",
      "Walking Lunges",
      "Bulgarian Split Squat",
      "Romanian Deadlift",
      "Hip Thrust Machine",
      "Glute Kickback Machine",
      "Hip Abductor Machine",
      "Hip Adductor Machine",
      "Standing Calf Raise Machine",
      "Seated Calf Raise Machine",
      "Glute Ham Raise",
    ],
  },
  {
    label: "Shoulders",
    color: "#0d9488",
    options: [
      "Barbell Overhead Press",
      "Dumbbell Shoulder Press",
      "Shoulder Press Machine",
      "Smith Machine Shoulder Press",
      "Arnold Press",
      "Lateral Raise Machine",
      "Dumbbell Lateral Raise",
      "Cable Lateral Raise",
      "Front Raise",
      "Rear Delt Fly Machine",
      "Cable Upright Row",
      "Barbell Shrugs",
      "Dumbbell Shrugs",
      "Landmine Press",
    ],
  },
  {
    label: "Arms",
    color: "#dc2626",
    options: [
      "Barbell Curl",
      "Dumbbell Curl",
      "Hammer Curl",
      "Preacher Curl Machine",
      "Cable Bicep Curl",
      "Bicep Curl Machine",
      "Tricep Pushdown (Cable)",
      "Overhead Tricep Extension",
      "Skull Crushers",
      "Tricep Extension Machine",
      "Seated Dip Machine",
      "Close-Grip Bench Press",
    ],
  },
  {
    label: "Core",
    color: "#16a34a",
    options: [
      "Plank",
      "Crunches",
      "Cable Crunch",
      "Ab Crunch Machine",
      "Hanging Leg Raise",
      "Torso Rotation Machine",
      "Russian Twist",
      "Sit-Ups",
      "Cable Woodchopper",
      "Ab Roller",
    ],
  },
  {
    label: "Cardio",
    color: "#db2777",
    options: [
      "Treadmill",
      "Elliptical",
      "Stationary Bike",
      "Recumbent Bike",
      "Rowing Machine",
      "Stair Climber",
      "Ski Erg",
      "Assault Bike",
      "Sled Push",
      "Battle Ropes",
      "Kettlebell Swing",
      "Farmer's Carry",
    ],
  },
];

export const EXERCISE_TO_CATEGORY: Record<string, { label: string; color: string }> = {};
EXERCISE_GROUPS.forEach((g) => g.options.forEach((o) => (EXERCISE_TO_CATEGORY[o] = g)));
export const OTHER_CATEGORY = { label: "Other", color: "#6b7280" };

export function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
