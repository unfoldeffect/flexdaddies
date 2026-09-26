-- Saved per-exercise notes. Each person keeps a running list of notes for each
-- exercise (form cues, seat settings, how it felt) that shows up every time
-- they pick that exercise, and each note can be edited or deleted.
CREATE TABLE IF NOT EXISTS exercise_notes (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercise_notes_user_exercise
  ON exercise_notes(user, exercise_name);

-- Carry over notes already typed into past workouts so nothing is lost.
-- Identical notes for the same person + exercise collapse into one.
INSERT OR IGNORE INTO exercise_notes (id, user, exercise_name, text, created_at, updated_at)
SELECT
  'seed-' || lower(hex(randomblob(8))),
  w.user,
  json_extract(e.value, '$.name'),
  trim(json_extract(e.value, '$.notes')),
  MIN(w.logged_at),
  MIN(w.logged_at)
FROM workouts w, json_each(w.exercises) e
WHERE trim(coalesce(json_extract(e.value, '$.notes'), '')) <> ''
GROUP BY w.user, json_extract(e.value, '$.name'), trim(json_extract(e.value, '$.notes'));
