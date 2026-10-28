import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bindings } from "../bindings.server";
import { ensureMigrations } from "../migrate.server";

export const BODY_PARTS = ["waist", "neck", "arms", "chest", "thighs", "hips"] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

export type BodyMeasurement = {
  id: string;
  user: "Diego" | "Kevin";
  date: string;
  part: BodyPart;
  /** Always stored in inches. */
  valueIn: number;
  loggedAt: string;
};

type Row = {
  id: string;
  user: string;
  date: string;
  part: string;
  value_in: number;
  logged_at: string;
};

export const listBodyMeasurements = createServerFn({ method: "GET" }).handler(
  async (): Promise<BodyMeasurement[]> => {
    const { DB } = bindings();
    await ensureMigrations(DB).catch(() => {});
    if (!DB) return [];
    try {
      const { results } = await DB.prepare(
        "SELECT id, user, date, part, value_in, logged_at FROM body_measurements ORDER BY date DESC, logged_at DESC",
      ).all<Row>();
      return results.map((r) => ({
        id: r.id,
        user: r.user as BodyMeasurement["user"],
        date: r.date,
        part: r.part as BodyPart,
        valueIn: r.value_in,
        loggedAt: r.logged_at,
      }));
    } catch {
      // Table not there yet (migration 0018 not applied).
      return [];
    }
  },
);

const InputSchema = z.object({
  id: z.string().min(1),
  user: z.enum(["Diego", "Kevin"]),
  date: z.string().min(1),
  part: z.enum(BODY_PARTS),
  valueIn: z.number().positive(),
  loggedAt: z.string().min(1),
});

export const createBodyMeasurement = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data }) => {
    const { DB } = bindings();
    await ensureMigrations(DB).catch(() => {});
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare(
      "INSERT INTO body_measurements (id, user, date, part, value_in, logged_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(data.id, data.user, data.date, data.part, data.valueIn, data.loggedAt)
      .run();
    return { ok: true };
  });

export const deleteBodyMeasurement = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1), user: z.enum(["Diego", "Kevin"]) }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    await ensureMigrations(DB).catch(() => {});
    if (!DB) throw new Error("Database unavailable");
    await DB.prepare("DELETE FROM body_measurements WHERE id = ? AND user = ?")
      .bind(data.id, data.user)
      .run();
    return { ok: true };
  });
