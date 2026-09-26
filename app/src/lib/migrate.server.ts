// Self-applying database migrations.
//
// Pushing to main deploys the code automatically, but D1 migrations used to
// need a manual `wrangler d1 migrations apply` with a Cloudflare API token.
// Instead, the live Worker (which already has full access to its own DB
// binding) applies any new files in app/migrations/ the first time it touches
// the database after a deploy.
//
// It records each file in wrangler's own `d1_migrations` table, so running
// `wrangler d1 migrations apply` by hand later still works and skips anything
// already applied here.
//
// Safety:
// - Only migrations numbered ABOVE AUTO_APPLY_AFTER are ever auto-applied.
//   0001–0011 were applied by hand before this existed; some of them rewrite
//   the preset plans, so they must never re-run.
// - A migration is "claimed" by inserting its row into d1_migrations first
//   (the name column is UNIQUE), so two Workers starting at once can't both
//   run it. If the SQL fails, the claim is removed so it retries next time.
// - Each file runs as one D1 batch (a single transaction).
import type { D1Database } from "@cloudflare/workers-types";

const AUTO_APPLY_AFTER = 11;

const files = import.meta.glob("../../migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

type Migration = { name: string; number: number; sql: string };

const MIGRATIONS: Migration[] = Object.entries(files)
  .map(([path, sql]) => {
    const name = path.split("/").pop() ?? path;
    return { name, number: parseInt(name, 10), sql };
  })
  .filter((m) => Number.isFinite(m.number))
  .sort((a, b) => a.number - b.number);

// Splits a migration file into statements. Keep migration files simple:
// `--` comments on their own lines and no semicolons inside string values.
function splitStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function applyPending(DB: D1Database) {
  await DB.prepare(
    "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  ).run();
  const { results } = await DB.prepare("SELECT name FROM d1_migrations").all<{ name: string }>();
  const applied = new Set(results.map((r) => r.name));

  for (const m of MIGRATIONS) {
    if (m.number <= AUTO_APPLY_AFTER || applied.has(m.name)) continue;
    const claim = await DB.prepare("INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)")
      .bind(m.name)
      .run();
    if (!claim.meta.changes) continue; // another Worker got it first
    try {
      await DB.batch(splitStatements(m.sql).map((s) => DB.prepare(s)));
      console.log(`[migrate] applied ${m.name}`);
    } catch (err) {
      await DB.prepare("DELETE FROM d1_migrations WHERE name = ?").bind(m.name).run();
      console.error(`[migrate] failed ${m.name}`, err);
      throw err;
    }
  }
}

let ready: Promise<void> | null = null;

/** Make sure every migration has been applied. Cheap after the first call. */
export function ensureMigrations(DB: D1Database | undefined): Promise<void> {
  if (!DB) return Promise.resolve();
  if (!ready) {
    ready = applyPending(DB).catch((err) => {
      ready = null; // try again on the next request
      throw err;
    });
  }
  return ready;
}
