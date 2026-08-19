-- Every exercise offers at most 3 sets now — bring the preset plans in line
-- (a few exercises were originally seeded with 4 sets).
UPDATE workout_templates
SET exercises = REPLACE(exercises, '"sets":4', '"sets":3')
WHERE id IN ('preset-legs-monday', 'preset-push', 'preset-pull');
