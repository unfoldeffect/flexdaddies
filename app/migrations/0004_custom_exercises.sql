-- Custom exercises Diego/Kevin typed in via "Other" — remembered for future
-- use so they show up in the exercise dropdown from then on.
CREATE TABLE IF NOT EXISTS custom_exercises (
  name TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
