-- Shared workout log: one row per logged session, exercises stored as a JSON
-- array (each workout is a self-contained record — no need to normalize sets
-- into their own table for a fixed 3-set structure).
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  date TEXT NOT NULL,
  exercises TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  logged_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user);
