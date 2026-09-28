-- Edits to the built-in exercise list (which lives in code). One row per
-- built-in exercise that was renamed, re-categorized, or removed from the
-- dropdown. Removing only hides it from the list; logged workouts stay.
CREATE TABLE IF NOT EXISTS exercise_overrides (
  original_name TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
