import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bindings } from "../bindings.server";

export type WeighInUser = "Diego" | "Kevin";

export type WeighIn = {
  id: string;
  user: WeighInUser;
  date: string;
  weight: number;
  loggedAt: string;
};

type WeighInRow = {
  id: string;
  user: string;
  date: string;
  weight: number;
  logged_at: string;
};

function rowToWeighIn(row: WeighInRow): WeighIn {
  return {
    id: row.id,
    user: row.user as WeighInUser,
    date: row.date,
    weight: row.weight,
    loggedAt: row.logged_at,
  };
}

export const listWeighIns = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  if (!DB) return [] as WeighIn[];
  const { results } = await DB.prepare(
    "SELECT id, user, date, weight, logged_at FROM weigh_ins ORDER BY date DESC, logged_at DESC",
  ).all<WeighInRow>();
  return results.map(rowToWeighIn);
});

const WeighInInputSchema = z.object({
  id: z.string().min(1),
  user: z.enum(["Diego", "Kevin"]),
  date: z.string().min(1),
  weight: z.number().min(0),
  loggedAt: z.string().min(1),
});

export const createWeighIn = createServerFn({ method: "POST" })
  .inputValidator(WeighInInputSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare(
      "INSERT INTO weigh_ins (id, user, date, weight, logged_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(data.id, data.user, data.date, data.weight, data.loggedAt)
      .run();
    return { ok: true };
  });

export const deleteWeighIn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1), user: z.enum(["Diego", "Kevin"]) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare("DELETE FROM weigh_ins WHERE id = ? AND user = ?")
      .bind(data.id, data.user)
      .run();
    return { ok: true };
  });
