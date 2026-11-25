// The thinking behind backing the phone's data up to the account: what to do
// when the phone and the saved copy differ, and how to join two copies
// without losing anything. Pure logic, so it can be tested on its own.
import type { Db } from './types';

/** What this phone remembers about its last save to the account. */
export type SyncMeta = {
  /** The account the data on this phone belongs to. */
  accountId: string;
  /** The saved copy this phone last saw (0 = none yet). */
  rev: number;
  /** True when something changed on the phone since then. */
  dirty: boolean;
};

export type SavedCopy = { rev: number; data: Db | null };

export type SyncStep =
  /** Nothing to do. */
  | 'none'
  /** Send the phone's data up. */
  | 'push'
  /** Replace the phone's data with the saved copy. */
  | 'take'
  /** Join the two, keep the result on the phone and send it up. */
  | 'merge'
  /** A different account signed in and has nothing saved: start it empty. */
  | 'clear';

export const isEmptyDb = (db: Db) => Object.values(db).every((list) => list.length === 0);

export function planSync(input: {
  meta: SyncMeta | null;
  accountId: string;
  local: Db;
  server: SavedCopy;
}): SyncStep {
  const { meta, accountId, local, server } = input;
  const localEmpty = isEmptyDb(local);

  // Another account's data is on this phone: never mix the two.
  if (meta && meta.accountId !== accountId) return server.data ? 'take' : 'clear';

  // First save from this phone.
  if (!meta) {
    if (!server.data) return localEmpty ? 'none' : 'push';
    return localEmpty ? 'take' : 'merge';
  }

  if (!server.data) return localEmpty ? 'none' : 'push';
  if (server.rev === meta.rev) return meta.dirty ? 'push' : 'none';
  // Another phone saved since this one last looked.
  return meta.dirty && !localEmpty ? 'merge' : 'take';
}

function union<T>(mine: T[], theirs: T[], key: (item: T) => string): T[] {
  const seen = new Set(mine.map(key));
  return [...mine, ...theirs.filter((item) => !seen.has(key(item)))];
}

/**
 * Joins two copies. Nothing is thrown away: where both hold the same entry,
 * this phone's version wins. (So an entry deleted on one phone while the other
 * was offline can come back; a lost workout would be worse.)
 */
export function mergeDb(mine: Db, theirs: Db): Db {
  const byId = (x: { id: string }) => x.id;
  return {
    workouts: union(mine.workouts, theirs.workouts, byId),
    weighIns: union(mine.weighIns, theirs.weighIns, byId),
    measurements: union(mine.measurements, theirs.measurements, byId),
    templates: union(mine.templates, theirs.templates, byId),
    exerciseNotes: union(mine.exerciseNotes, theirs.exerciseNotes, byId),
    customExercises: union(mine.customExercises, theirs.customExercises, (c) => c.name.toLowerCase()),
    exerciseOverrides: union(mine.exerciseOverrides, theirs.exerciseOverrides, (o) => o.originalName.toLowerCase()),
  };
}

export type BackupStatus =
  /** Not signed in, or this build has no server. */
  | { state: 'off' }
  | { state: 'saving' }
  | { state: 'saved'; at: number }
  /** Could not reach the server; it will try again. */
  | { state: 'waiting' };

export function describeBackup(status: BackupStatus, now: number = Date.now()): string {
  if (status.state === 'saving') return 'Saving to your account...';
  if (status.state === 'waiting') return "Not saved to your account yet. It will try again when there's a connection.";
  if (status.state === 'saved') {
    const minutes = Math.floor((now - status.at) / 60000);
    if (minutes < 1) return 'Saved to your account just now.';
    if (minutes < 60) return `Saved to your account ${minutes} min ago.`;
    return 'Saved to your account earlier today.';
  }
  return 'Kept on this phone.';
}
