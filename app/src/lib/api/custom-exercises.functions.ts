import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bindings } from "../bindings.server";

export type CustomExercise = { name: string; category: string };

export const listCustomExercises = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
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
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare(
      "INSERT OR IGNORE INTO custom_exercises (name, category, created_by, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(data.name, data.category, data.createdBy, new Date().toISOString())
      .run();
    return { ok: true };
  });
