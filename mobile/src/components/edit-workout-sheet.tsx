// Edit a workout that was already logged (opened from History).
import { useState } from 'react';
import { View } from 'react-native';

import { useStore } from '../data/store';
import { workoutExercisesToDraft, type DraftExercise } from '../lib/draft';
import { computeLastPerformance } from '../lib/stats';
import type { Workout } from '../lib/types';
import { USERS } from '../lib/workout-data';
import { KeyboardScroll } from './keyboard-scroll';
import { ManageExercisesSheet } from './manage-exercises';
import { Sheet } from './sheet';
import { useScrollBridge } from './sortable-list';
import { WorkoutForm } from './workout-form';

export function EditWorkoutSheet({
  workout,
  onClose,
}: {
  /** The workout being edited, or null when the sheet is closed. */
  workout: Workout | null;
  onClose: () => void;
}) {
  return (
    <Sheet visible={!!workout} title="Edit Workout" onClose={onClose} closeLabel="Cancel">
      {workout && <EditWorkoutBody key={workout.id} workout={workout} onClose={onClose} />}
    </Sheet>
  );
}

function EditWorkoutBody({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const { db, groups, toCategory, editWorkout, registerExercise } = useStore();
  const [date, setDate] = useState(workout.date);
  const [exercises, setExercises] = useState<DraftExercise[]>(() =>
    workoutExercisesToDraft(workout.exercises, toCategory),
  );
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState(false);
  const { bridge, scrollProps, hostProps, overlay } = useScrollBridge();

  return (
    <View {...hostProps}>
      <KeyboardScroll {...scrollProps}>
        <WorkoutForm
          date={date}
          onChangeDate={setDate}
          exercises={exercises}
          onChangeExercises={(update) => setExercises(update)}
          submitLabel="SAVE CHANGES"
          saving={saving}
          onCancel={onClose}
          groups={groups}
          toCategory={toCategory}
          lastPerformance={computeLastPerformance(db.workouts, workout.user)}
          currentUser={workout.user}
          otherUser={USERS.find((u) => u !== workout.user) ?? workout.user}
          onManageExercises={() => setManaging(true)}
          scroll={bridge}
          onSubmit={async (built) => {
            setSaving(true);
            const ok = await editWorkout(workout.id, {
              date: built.date,
              exercises: built.exercises,
              notes: '',
            });
            setSaving(false);
            if (ok) {
              built.toRegister.forEach((r) => registerExercise(r.name, r.category));
              onClose();
            }
            return ok;
          }}
        />
      </KeyboardScroll>
      {overlay}
      <ManageExercisesSheet visible={managing} onClose={() => setManaging(false)} />
    </View>
  );
}
