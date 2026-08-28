-- Drop the "(Day)" suffix from the Upper/Lower A/B plan names, matching the
-- earlier simplification applied to the original preset plans.
UPDATE workout_templates SET name = '1 - Upper A' WHERE id = 'preset-upper-a';
UPDATE workout_templates SET name = '2 - Lower A' WHERE id = 'preset-lower-a';
UPDATE workout_templates SET name = '3 - Upper B' WHERE id = 'preset-upper-b';
UPDATE workout_templates SET name = '4 - Lower B' WHERE id = 'preset-lower-b';
