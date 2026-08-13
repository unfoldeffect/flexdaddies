import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bindings } from "../bindings.server";

export type TemplateExercise = { name: string; sets: number; reps?: string };
export type WorkoutTemplate = {
  id: string;
  name: string;
  createdBy: string;
  exercises: TemplateExercise[];
};

type TemplateRow = {
  id: string;
  name: string;
  created_by: string;
  exercises: string;
};

export const listTemplates = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  if (!DB) return [] as WorkoutTemplate[];
  const { results } = await DB.prepare(
    "SELECT id, name, created_by, exercises FROM workout_templates ORDER BY name ASC",
  ).all<TemplateRow>();
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    exercises: JSON.parse(row.exercises) as TemplateExercise[],
  }));
});

const TemplateExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().min(1),
  reps: z.string().optional(),
});

const CreateTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  exercises: z.array(TemplateExerciseSchema).min(1),
  createdBy: z.enum(["Diego", "Kevin"]),
});

export const createTemplate = createServerFn({ method: "POST" })
  .inputValidator(CreateTemplateSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare(
      "INSERT INTO workout_templates (id, name, created_by, exercises, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        data.id,
        data.name,
        data.createdBy,
        JSON.stringify(data.exercises),
        new Date().toISOString(),
      )
      .run();
    return { ok: true };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare("DELETE FROM workout_templates WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });
