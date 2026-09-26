import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bindings } from "../bindings.server";

export type ExerciseNote = {
  id: string;
  user: "Diego" | "Kevin";
  exerciseName: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

type ExerciseNoteRow = {
  id: string;
  user: string;
  exercise_name: string;
  text: string;
  created_at: string;
  updated_at: string;
};

function rowToNote(row: ExerciseNoteRow): ExerciseNote {
  return {
    id: row.id,
    user: row.user as ExerciseNote["user"],
    exerciseName: row.exercise_name,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ExerciseNotesResult = { available: boolean; notes: ExerciseNote[] };

export const listExerciseNotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExerciseNotesResult> => {
    const { DB } = bindings();
    if (!DB) return { available: false, notes: [] };
    try {
      const { results } = await DB.prepare(
        "SELECT id, user, exercise_name, text, created_at, updated_at FROM exercise_notes ORDER BY created_at DESC",
      ).all<ExerciseNoteRow>();
      return { available: true, notes: results.map(rowToNote) };
    } catch {
      // Table not there yet (migration 0012 not applied) — the app falls back
      // to the old single notes box until it is.
      return { available: false, notes: [] };
    }
  },
);

const AddNoteSchema = z.object({
  id: z.string().min(1),
  user: z.enum(["Diego", "Kevin"]),
  exerciseName: z.string().min(1),
  text: z.string().trim().min(1),
  createdAt: z.string().min(1),
});

export const addExerciseNote = createServerFn({ method: "POST" })
  .inputValidator(AddNoteSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare(
      "INSERT INTO exercise_notes (id, user, exercise_name, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(data.id, data.user, data.exerciseName, data.text, data.createdAt, data.createdAt)
      .run();
    return { ok: true };
  });

const UpdateNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1),
});

export const updateExerciseNote = createServerFn({ method: "POST" })
  .inputValidator(UpdateNoteSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare("UPDATE exercise_notes SET text = ?, updated_at = ? WHERE id = ?")
      .bind(data.text, new Date().toISOString(), data.id)
      .run();
    return { ok: true };
  });

const DeleteNoteSchema = z.object({ id: z.string().min(1) });

export const deleteExerciseNote = createServerFn({ method: "POST" })
  .inputValidator(DeleteNoteSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare("DELETE FROM exercise_notes WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });
