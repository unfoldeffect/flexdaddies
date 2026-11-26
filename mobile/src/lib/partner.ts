// Partner sync (Pro): what one phone sends when a session is logged for both
// people, and what the other phone does with it. Pure logic.
import type { Db, Workout } from './types';

/**
 * A session as the sending phone saw it: `mine` is the sender's own workout,
 * `theirs` is what the sender logged for the partner.
 */
export type SharedSession = { id: string; mine: Workout; theirs: Workout };

export function toShare(mine: Workout, theirs: Workout): SharedSession {
  return { id: mine.id, mine, theirs };
}

function looksLikeWorkout(w: unknown): w is Workout {
  const x = w as Workout | null;
  return !!x && typeof x.id === 'string' && typeof x.date === 'string' && Array.isArray(x.exercises);
}

/**
 * On the receiving phone the two swap places: what was logged for me is mine,
 * and the sender's own workout is my partner's. Plan labels stay with the
 * phone that made them.
 */
export function receiveSession(session: unknown): Workout[] {
  const s = session as SharedSession | null;
  if (!s || !looksLikeWorkout(s.mine) || !looksLikeWorkout(s.theirs)) return [];
  return [
    { ...s.theirs, user: 'me', template: null },
    { ...s.mine, user: 'partner', template: null },
  ];
}

/** Adds received sessions. Anything already on the phone (same id) is left alone. */
export function addReceived(db: Db, sessions: unknown[]): Db {
  const have = new Set(db.workouts.map((w) => w.id));
  const fresh: Workout[] = [];
  for (const s of sessions) {
    for (const w of receiveSession(s)) {
      if (have.has(w.id)) continue;
      have.add(w.id);
      fresh.push(w);
    }
  }
  return fresh.length ? { ...db, workouts: [...db.workouts, ...fresh] } : db;
}
