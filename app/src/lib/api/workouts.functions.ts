import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bindings } from "../bindings.server";

const SetSchema = z.object({
  reps: z.number().min(0),
  weight: z.number().min(0),
});

const ExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.array(SetSchema).min(1),
});

const WorkoutInputSchema = z.object({
  id: z.string().min(1),
  user: z.enum(["Diego", "Kevin"]),
  date: z.string().min(1),
  exercises: z.array(ExerciseSchema).min(1),
  notes: z.string().default(""),
  loggedAt: z.string().min(1),
});

export type WorkoutUser = "Diego" | "Kevin";

export type Workout = {
  id: string;
  user: WorkoutUser;
  date: string;
  exercises: { name: string; sets: { reps: number; weight: number }[] }[];
  notes: string;
  loggedAt: string;
};

type WorkoutRow = {
  id: string;
  user: string;
  date: string;
  exercises: string;
  notes: string;
  logged_at: string;
};

function rowToWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    user: row.user as WorkoutUser,
    date: row.date,
    exercises: JSON.parse(row.exercises),
    notes: row.notes,
    loggedAt: row.logged_at,
  };
}

export const listWorkouts = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  if (!DB) return [] as Workout[];
  const { results } = await DB.prepare(
    "SELECT id, user, date, exercises, notes, logged_at FROM workouts ORDER BY date DESC, logged_at DESC",
  ).all<WorkoutRow>();
  return results.map(rowToWorkout);
});

export const createWorkout = createServerFn({ method: "POST" })
  .inputValidator(WorkoutInputSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare(
      "INSERT INTO workouts (id, user, date, exercises, notes, logged_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        data.id,
        data.user,
        data.date,
        JSON.stringify(data.exercises),
        data.notes,
        data.loggedAt,
      )
      .run();
    return { ok: true };
  });

export const deleteWorkout = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1), user: z.enum(["Diego", "Kevin"]) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare("DELETE FROM workouts WHERE id = ? AND user = ?")
      .bind(data.id, data.user)
      .run();
    return { ok: true };
  });

const WorkoutUpdateSchema = z.object({
  id: z.string().min(1),
  user: z.enum(["Diego", "Kevin"]),
  date: z.string().min(1),
  exercises: z.array(ExerciseSchema).min(1),
  notes: z.string().default(""),
});

export const updateWorkout = createServerFn({ method: "POST" })
  .inputValidator(WorkoutUpdateSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare(
      "UPDATE workouts SET date = ?, exercises = ?, notes = ? WHERE id = ? AND user = ?",
    )
      .bind(data.date, JSON.stringify(data.exercises), data.notes, data.id, data.user)
      .run();
    return { ok: true };
  });
