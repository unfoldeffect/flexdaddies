// A stand-in for Cloudflare's D1 database on a Mac, using the SQLite built
// into Node. Used by the tests and by dev-server.ts; never deployed.
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import type { Database, Statement } from './handle.ts';

export function openLocalDb(file = ':memory:'): Database {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  const dir = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, dir), 'utf8'));
  }
  const statement = (sql: string, values: unknown[]): Statement & { exec: () => void } => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => (db.prepare(sql).get(...(values as never[])) as T | undefined) ?? null,
    run: async () => db.prepare(sql).run(...(values as never[])),
    exec: () => void db.prepare(sql).run(...(values as never[])),
  });
  return {
    prepare: (sql) => statement(sql, []),
    batch: async (statements) => {
      db.exec('BEGIN');
      try {
        for (const s of statements) (s as Statement & { exec: () => void }).exec();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
