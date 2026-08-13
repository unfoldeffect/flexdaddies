-- Simplify the preset plan names — drop the "(Day)" suffix.
UPDATE workout_templates SET name = 'Legs' WHERE id = 'preset-legs-monday';
UPDATE workout_templates SET name = 'Push' WHERE id = 'preset-push-wednesday';
UPDATE workout_templates SET name = 'Pull' WHERE id = 'preset-pull-friday';
UPDATE workout_templates SET name = 'Upper' WHERE id = 'preset-upper-sunday';
