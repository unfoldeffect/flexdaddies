import { tone } from "../theme";
import { MOVEMENT_GROUPS } from "./movements";

// Who a workout belongs to on this phone: the person signed in ("me") and,
// only if they switch it on in Settings, one partner they lift with.
// The names shown on screen come from the account and from Settings.
export const USERS = ["me", "partner"] as const;
export type WorkoutUser = (typeof USERS)[number];
export type PersonNames = Record<WorkoutUser, string>;

// Colours are read through tone(), so they follow dark or light mode.
export const USER_COLORS: Record<WorkoutUser, string> = {
  get me() {
    return tone("#2555c7");
  },
  get partner() {
    return tone("#b5651d");
  },
};

export const OTHER_VALUE = "__other__";
export const NUM_SETS = 3;

export type ExerciseGroup = { label: string; color: string; options: string[] };

// The store app's list: one entry per movement (see movements.ts). This file
// used to be a copy of the website's; it now differs on purpose.
export const EXERCISE_GROUPS: ExerciseGroup[] = MOVEMENT_GROUPS.map((g) => ({
  label: g.label,
  get color() {
    return tone(g.color);
  },
  options: g.movements.map((m) => m.name),
}));

export const EXERCISE_TO_CATEGORY: Record<string, { label: string; color: string }> = {};
EXERCISE_GROUPS.forEach((g) => g.options.forEach((o) => (EXERCISE_TO_CATEGORY[o] = g)));
export const OTHER_CATEGORY = {
  label: "Other",
  get color() {
    return tone("#6b7280");
  },
};
export const CARDIO_LABEL = "Cardio";
export const CATEGORY_LABELS = EXERCISE_GROUPS.map((g) => g.label);
export const CATEGORY_COLORS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, label: string) =>
    label === OTHER_CATEGORY.label
      ? OTHER_CATEGORY.color
      : EXERCISE_GROUPS.find((g) => g.label === label)?.color,
});

export type CategoryInfo = { label: string; color: string };
export type MergedExerciseData = {
  groups: ExerciseGroup[];
  toCategory: Record<string, CategoryInfo>;
};

// Combines the built-in exercise list with exercises typed in via "Other"
// and remembered server-side, so they show up as normal dropdown options
// from then on. Custom exercises are grouped under their chosen category,
// or under a trailing "Other" group when no category was picked.
export type ExerciseOverrideInput = {
  originalName: string;
  name: string;
  category: string;
  hidden: boolean;
};

// One row in the "Manage Exercises" screen.
export type ManagedExercise = {
  name: string;
  category: string;
  color: string;
  builtinOriginal?: string; // set for built-in exercises
  hidden: boolean;
};

function categoryInfo(label: string): CategoryInfo {
  const g = EXERCISE_GROUPS.find((x) => x.label.toLowerCase() === label.toLowerCase());
  return g
    ? { label: g.label, color: g.color }
    : { label: OTHER_CATEGORY.label, color: OTHER_CATEGORY.color };
}

export function mergeExerciseGroups(
  custom: { name: string; category: string }[],
  overrides: ExerciseOverrideInput[] = [],
): MergedExerciseData & { managed: ManagedExercise[] } {
  const groups: ExerciseGroup[] = EXERCISE_GROUPS.map((g) => ({ ...g, options: [] }));
  let otherGroup: ExerciseGroup | undefined;
  const toCategory: Record<string, CategoryInfo> = {};
  const knownLower = new Set<string>();
  const managed: ManagedExercise[] = [];
  const byOriginal = new Map(overrides.map((o) => [o.originalName, o]));

  const place = (name: string, cat: CategoryInfo) => {
    let group = groups.find((g) => g.label === cat.label);
    if (!group) {
      if (!otherGroup) {
        otherGroup = { label: OTHER_CATEGORY.label, color: OTHER_CATEGORY.color, options: [] };
      }
      group = otherGroup;
    }
    group.options.push(name);
  };

  for (const g of EXERCISE_GROUPS) {
    for (const original of g.options) {
      const o = byOriginal.get(original);
      const name = o?.name || original;
      const cat = o ? categoryInfo(o.category) : { label: g.label, color: g.color };
      // Keep the category even when hidden, so past workouts keep their color.
      toCategory[name] = cat;
      knownLower.add(name.toLowerCase());
      const hidden = !!o?.hidden;
      managed.push({
        name,
        category: cat.label,
        color: cat.color,
        builtinOriginal: original,
        hidden,
      });
      if (!hidden) place(name, cat);
    }
  }

  for (const { name, category } of custom) {
    if (!name || knownLower.has(name.toLowerCase())) continue;
    const cat = categoryInfo(category);
    toCategory[name] = cat;
    knownLower.add(name.toLowerCase());
    managed.push({ name, category: cat.label, color: cat.color, hidden: false });
    place(name, cat);
  }

  const visibleGroups = groups.filter((g) => g.options.length);
  if (otherGroup) visibleGroups.push(otherGroup);

  return { groups: visibleGroups, toCategory, managed };
}

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
