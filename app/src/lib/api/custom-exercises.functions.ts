import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bindings } from "../bindings.server";
import { ensureMigrations } from "../migrate.server";

export type CustomExercise = { name: string; category: string };

export const listCustomExercises = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  await ensureMigrations(DB).catch(() => {});
  if (!DB) return [] as CustomExercise[];
  const { results } = await DB.prepare(
    "SELECT name, category FROM custom_exercises ORDER BY name ASC",
  ).all<CustomExercise>();
  return results;
});

const AddCustomExerciseSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  createdBy: z.enum(["Diego", "Kevin"]),
});

export const addCustomExercise = createServerFn({ method: "POST" })
  .inputValidator(AddCustomExerciseSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    await ensureMigrations(DB).catch(() => {});
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare(
      // New exercise → insert. Already saved as "Other" → take the real
      // category once one is picked. Never overwrite a real category.
      "INSERT INTO custom_exercises (name, category, created_by, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET category = excluded.category WHERE custom_exercises.category = 'Other' AND excluded.category <> 'Other'",
    )
      .bind(data.name, data.category, data.createdBy, new Date().toISOString())
      .run();
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Editing / removing exercises from the dropdown list.
//
// Built-in exercises live in code, so changes to them are stored as rows in
// exercise_overrides (keyed by their original name). Custom exercises are
// edited directly in custom_exercises. Renaming either one also renames it in
// past workouts, plans, and saved notes so history and stats stay connected.
// Removing never touches logged workouts — it only takes it off the list.

export type ExerciseOverride = {
  originalName: string;
  name: string;
  category: string;
  hidden: boolean;
};

type OverrideRow = { original_name: string; name: string; category: string; hidden: number };

export const listExerciseOverrides = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  await ensureMigrations(DB).catch(() => {});
  if (!DB) return [] as ExerciseOverride[];
  try {
    const { results } = await DB.prepare(
      "SELECT original_name, name, category, hidden FROM exercise_overrides",
    ).all<OverrideRow>();
    return results.map((r) => ({
      originalName: r.original_name,
      name: r.name,
      category: r.category,
      hidden: !!r.hidden,
    }));
  } catch {
    return [] as ExerciseOverride[];
  }
});

type D1 = NonNullable<ReturnType<typeof bindings>["DB"]>;

async function renameEverywhere(DB: D1, from: string, to: string) {
  if (from === to) return;
  const stmts = [];
  const { results: workouts } = await DB.prepare("SELECT id, exercises FROM workouts").all<{
    id: string;
    exercises: string;
  }>();
  for (const w of workouts) {
    const list = JSON.parse(w.exercises) as { name: string }[];
    if (!list.some((e) => e.name === from)) continue;
    const next = list.map((e) => (e.name === from ? { ...e, name: to } : e));
    stmts.push(
      DB.prepare("UPDATE workouts SET exercises = ? WHERE id = ?").bind(JSON.stringify(next), w.id),
    );
  }
  const { results: templates } = await DB.prepare(
    "SELECT id, exercises FROM workout_templates",
  ).all<{ id: string; exercises: string }>();
  for (const t of templates) {
    const list = JSON.parse(t.exercises) as { name: string }[];
    if (!list.some((e) => e.name === from)) continue;
    const next = list.map((e) => (e.name === from ? { ...e, name: to } : e));
    stmts.push(
      DB.prepare("UPDATE workout_templates SET exercises = ? WHERE id = ?").bind(
        JSON.stringify(next),
        t.id,
      ),
    );
  }
  stmts.push(
    DB.prepare("UPDATE exercise_notes SET exercise_name = ? WHERE exercise_name = ?").bind(
      to,
      from,
    ),
  );
  await DB.batch(stmts);
}

const UpdateExerciseSchema = z.object({
  currentName: z.string().min(1),
  newName: z.string().trim().min(1),
  category: z.string().min(1),
  // Set for built-in exercises (their name in the code list).
  builtinOriginal: z.string().optional(),
});

export const updateExercise = createServerFn({ method: "POST" })
  .inputValidator(UpdateExerciseSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    await ensureMigrations(DB).catch(() => {});
    if (!DB) throw new Error("Database unavailable");
    const now = new Date().toISOString();
    if (data.builtinOriginal) {
      await DB.prepare(
        "INSERT INTO exercise_overrides (original_name, name, category, hidden, updated_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT(original_name) DO UPDATE SET name = excluded.name, category = excluded.category, hidden = 0, updated_at = excluded.updated_at",
      )
        .bind(data.builtinOriginal, data.newName, data.category, now)
        .run();
    } else {
      await DB.prepare("UPDATE custom_exercises SET name = ?, category = ? WHERE name = ?")
        .bind(data.newName, data.category, data.currentName)
        .run();
    }
    await renameEverywhere(DB, data.currentName, data.newName);
    return { ok: true };
  });

const RemoveExerciseSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  builtinOriginal: z.string().optional(),
});

export const removeExercise = createServerFn({ method: "POST" })
  .inputValidator(RemoveExerciseSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    await ensureMigrations(DB).catch(() => {});
    if (!DB) throw new Error("Database unavailable");
    if (data.builtinOriginal) {
      await DB.prepare(
        "INSERT INTO exercise_overrides (original_name, name, category, hidden, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(original_name) DO UPDATE SET hidden = 1, updated_at = excluded.updated_at",
      )
        .bind(data.builtinOriginal, data.name, data.category, new Date().toISOString())
        .run();
    } else {
      await DB.prepare("DELETE FROM custom_exercises WHERE name = ?").bind(data.name).run();
    }
    return { ok: true };
  });

const RestoreExerciseSchema = z.object({ builtinOriginal: z.string().min(1) });

export const restoreExercise = createServerFn({ method: "POST" })
  .inputValidator(RestoreExerciseSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    await ensureMigrations(DB).catch(() => {});
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare(
      "UPDATE exercise_overrides SET hidden = 0, updated_at = ? WHERE original_name = ?",
    )
      .bind(new Date().toISOString(), data.builtinOriginal)
      .run();
    return { ok: true };
  });
