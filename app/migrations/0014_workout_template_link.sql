-- Remember which plan (if any) a workout was started from, so History can
-- show "Upper A" etc. instead of only the exercise list. The name is copied
-- at log time so the label stays right even if the plan is renamed later.
-- Both stay NULL for workouts logged from scratch and for everything already
-- in the table.
ALTER TABLE workouts ADD COLUMN template_id TEXT;
ALTER TABLE workouts ADD COLUMN template_name TEXT;
