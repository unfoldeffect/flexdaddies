-- One-time backfill: tag past workouts with the plan they clearly came from.
-- Matched by comparing each workout's exercise list against the current plans
-- and the earlier versions of the plans (Legs/Push/Pull from August). Only
-- workouts where at least half the exercises line up with the plan (and vice
-- versa) are tagged; the rest are left alone. Only fills rows still untagged.

UPDATE workouts SET template_id = 'preset-legs-monday', template_name = 'Legs' WHERE id = '1786356052673-qsqgmcy' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-pull-friday', template_name = 'Pull' WHERE id = '1786702576108-50kow2t' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-legs-monday', template_name = 'Legs' WHERE id = '1786990331217-lhvd0o3' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-pull-friday', template_name = 'Pull' WHERE id = '1787306950925-qkkotkm' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-legs-monday', template_name = 'Legs' WHERE id = '1787565851010-jru0qy4' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-lower-a', template_name = '2 - Lower A' WHERE id = '1787565851010-5c6h9px' AND template_id IS NULL;
UPDATE workouts SET template_id = '1790430349878-iyn27uj', template_name = '1 - Upper A' WHERE id = '1787910326925-ec66pwh' AND template_id IS NULL;
UPDATE workouts SET template_id = '1790430349878-iyn27uj', template_name = '1 - Upper A' WHERE id = '1787910326925-0fox8c1' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-lower-a', template_name = '2 - Lower A' WHERE id = '1788095278075-6mgvxen' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-upper-b', template_name = '3 - Upper B' WHERE id = '1788169916623-rmhj1z8' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-upper-b', template_name = '3 - Upper B' WHERE id = '1788169916623-grz9a35' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-upper-b', template_name = '3 - Upper B' WHERE id = '1788516602575-nxhjoqu' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-lower-b', template_name = '4 - Lower B' WHERE id = '1788699666807-gp6acr8' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-lower-a', template_name = '2 - Lower A' WHERE id = '1788949164283-w6ihgv1' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-upper-b', template_name = '3 - Upper B' WHERE id = '1789121408773-ooi1bqm' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-lower-b', template_name = '4 - Lower B' WHERE id = '1789304238245-mklenvw' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-upper-b', template_name = '3 - Upper B' WHERE id = '1789984101585-3fwfywy' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-upper-b', template_name = '3 - Upper B' WHERE id = '1789984101586-240ga3k' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-lower-b', template_name = '4 - Lower B' WHERE id = '1790157900074-ivb3xmd' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-lower-b', template_name = '4 - Lower B' WHERE id = '1790157900074-l1blhqy' AND template_id IS NULL;
UPDATE workouts SET template_id = '1790430349878-iyn27uj', template_name = '1 - Upper A' WHERE id = '1790330110386-4zoa4nx' AND template_id IS NULL;
UPDATE workouts SET template_id = '1790430349878-iyn27uj', template_name = '1 - Upper A' WHERE id = '1790330110386-pvtg98j' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-lower-a', template_name = '2 - Lower A' WHERE id = '1790520386483-fazsaui' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-upper-b', template_name = '3 - Upper B' WHERE id = '1790589404158-8r441ch' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-upper-b', template_name = '3 - Upper B' WHERE id = '1791725154822-0t80pon' AND template_id IS NULL;
UPDATE workouts SET template_id = '1790430349878-iyn27uj', template_name = '1 - Upper A' WHERE id = '1791800458771-fd93tr5' AND template_id IS NULL;
UPDATE workouts SET template_id = 'preset-upper-b', template_name = '3 - Upper B' WHERE id = '1792027961282-74anf0m' AND template_id IS NULL;
