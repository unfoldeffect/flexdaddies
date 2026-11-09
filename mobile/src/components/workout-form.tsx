// The list of exercise cards with "Add another exercise" and the big save
// button. Used on the Log tab and when editing an old workout from History.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { NotesApi } from '../data/store';
import {
  buildFromDraft,
  canSaveDraft,
  emptyExercise,
  finalName,
  resolveCategory,
  type BuiltDraft,
  type DraftExercise,
  type ToCategory,
} from '../lib/draft';
import { buzzSuccess, tapLight } from '../lib/haptics';
import { moveToIndex } from '../lib/reorder';
import type {
  TemplateExercise,
  TemplateLink,
  WorkoutExercise,
  WorkoutTemplate,
} from '../lib/types';
import type { ExerciseGroup, WorkoutUser } from '../lib/workout-data';
import { applyOrderToPlan, moveItem, sameExerciseOrder } from '../lib/workout-helpers';
import { colors } from '../theme';
import { DateField } from './date-field';
import { ExerciseEditor } from './exercise-editor';
import { SortableList, type ScrollBridge } from './sortable-list';
import { FieldLabel, Icon, OutlineButton, PrimaryButton } from './ui';

type Props = {
  date: string;
  onChangeDate: (date: string) => void;
  exercises: DraftExercise[];
  onChangeExercises: (update: (prev: DraftExercise[]) => DraftExercise[]) => void;
  /** The plan this workout came from (Log tab only). */
  template?: TemplateLink | null;
  submitLabel: string;
  saving: boolean;
  onSubmit: (data: BuiltDraft & { date: string }) => Promise<boolean>;
  /** Present when editing an old workout. */
  onCancel?: () => void;
  groups: ExerciseGroup[];
  toCategory: ToCategory;
  lastPerformance: Record<string, WorkoutExercise>;
  lastPerformanceOther?: Record<string, WorkoutExercise>;
  togetherMode?: boolean;
  currentUser: WorkoutUser;
  otherUser: WorkoutUser;
  /** Log tab: notes are kept in the saved notes list. */
  notesApi?: NotesApi | null;
  /** Saved plans and a way to store a new exercise order on one (Log tab only). */
  templates?: WorkoutTemplate[];
  onSavePlanOrder?: (template: WorkoutTemplate, exercises: TemplateExercise[]) => Promise<boolean>;
  onManageExercises: () => void;
  scroll: ScrollBridge;
};

export function WorkoutForm({
  date,
  onChangeDate,
  exercises,
  onChangeExercises,
  template = null,
  submitLabel,
  saving,
  onSubmit,
  onCancel,
  groups,
  toCategory,
  lastPerformance,
  lastPerformanceOther,
  togetherMode = false,
  currentUser,
  otherUser,
  notesApi = null,
  templates,
  onSavePlanOrder,
  onManageExercises,
  scroll,
}: Props) {
  const [justSaved, setJustSaved] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);

  const updateExercise = (id: string, updated: DraftExercise) =>
    onChangeExercises((prev) => prev.map((ex) => (ex.id === id ? updated : ex)));
  const removeExercise = (id: string) =>
    onChangeExercises((prev) => prev.filter((ex) => ex.id !== id));
  const addExercise = () => {
    tapLight();
    onChangeExercises((prev) => [...prev, emptyExercise()]);
  };
  const nudgeExercise = (id: string, delta: -1 | 1) =>
    onChangeExercises((prev) =>
      moveItem(
        prev,
        prev.findIndex((ex) => ex.id === id),
        delta,
      ),
    );

  // Reordering here only changes this workout. If it came from a plan and the
  // order now differs, offer to store the new order on the plan as well.
  const plan = template && onSavePlanOrder ? templates?.find((t) => t.id === template.id) : null;
  const reorderedPlan = plan
    ? applyOrderToPlan(plan.exercises, exercises.map(finalName).filter(Boolean))
    : null;
  const planOrderChanged =
    !!plan && !!reorderedPlan && !sameExerciseOrder(plan.exercises, reorderedPlan);
  const savePlanOrder = async () => {
    if (!plan || !reorderedPlan || !onSavePlanOrder) return;
    setSavingOrder(true);
    const ok = await onSavePlanOrder(plan, reorderedPlan);
    setSavingOrder(false);
    if (ok) {
      buzzSuccess();
      setOrderSaved(true);
      setTimeout(() => setOrderSaved(false), 2200);
    }
  };

  const canSave = canSaveDraft(exercises, togetherMode);

  const handleSave = async () => {
    const built = buildFromDraft(exercises, {
      toCategory,
      togetherMode,
      withSavedNotes: !!notesApi,
      currentUser,
      otherUser,
    });
    if (!built.exercises.length && !built.exercisesOther.length) return;
    const ok = await onSubmit({ ...built, date });
    if (ok) {
      buzzSuccess();
      if (!onCancel) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2200);
      }
    }
  };

  return (
    <View>
      {template && (
        <View style={styles.planNote}>
          <Icon name="dumbbell" size={15} color={colors.muted} />
          <Text style={styles.planNoteText}>
            From plan: <Text style={styles.planNoteName}>{template.name}</Text>
          </Text>
          {planOrderChanged && (
            <OutlineButton
              compact
              label={savingOrder ? 'Saving...' : 'Save this order to plan'}
              disabled={savingOrder}
              onPress={savePlanOrder}
              style={styles.orderBtn}
            />
          )}
          {!planOrderChanged && orderSaved && <Text style={styles.orderSaved}>Order saved ✓</Text>}
        </View>
      )}

      <View style={styles.dateRow}>
        <FieldLabel>DATE</FieldLabel>
        <DateField value={date} onChange={onChangeDate} label="Workout date" />
      </View>

      <SortableList
        data={exercises}
        keyExtractor={(ex) => ex.id}
        scroll={scroll}
        ghostFor={(ex) => ({
          title: finalName(ex) || 'New exercise',
          color: resolveCategory(ex, toCategory)?.color ?? colors.muted,
        })}
        onMove={(from, to) => onChangeExercises((prev) => moveToIndex(prev, from, to))}
        renderItem={(ex, i, drag) => (
          <ExerciseEditor
            exercise={ex}
            onChange={(updated) => updateExercise(ex.id, updated)}
            onRemove={() => removeExercise(ex.id)}
            showRemove={exercises.length > 1}
            onMoveUp={() => nudgeExercise(ex.id, -1)}
            onMoveDown={() => nudgeExercise(ex.id, 1)}
            canMoveUp={i > 0}
            canMoveDown={i < exercises.length - 1}
            drag={exercises.length > 1 ? drag : undefined}
            groups={groups}
            toCategory={toCategory}
            lastPerformance={lastPerformance}
            lastPerformanceOther={lastPerformanceOther ?? {}}
            togetherMode={togetherMode}
            currentUser={currentUser}
            otherUser={otherUser}
            notesApi={notesApi}
            onManageExercises={onManageExercises}
          />
        )}
      />

      <OutlineButton
        icon="plus"
        label="Add Another Exercise"
        onPress={addExercise}
        style={styles.addBtn}
      />

      <PrimaryButton
        label={saving ? 'SAVING...' : justSaved ? 'SAVED ✓' : submitLabel}
        disabled={!canSave || saving}
        onPress={handleSave}
      />
      {onCancel && <OutlineButton label="Cancel" onPress={onCancel} style={styles.cancel} />}
    </View>
  );
}

const styles = StyleSheet.create({
  planNote: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  planNoteText: { fontSize: 15, color: colors.muted },
  planNoteName: { fontWeight: '700', color: colors.text },
  orderBtn: {
    marginLeft: 'auto',
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,162,39,0.16)',
  },
  orderSaved: { marginLeft: 'auto', fontWeight: '700', color: colors.goldDeep },
  dateRow: { gap: 8, marginBottom: 18 },
  addBtn: {
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    minHeight: 56,
    marginBottom: 18,
  },
  cancel: { marginTop: 10 },
});
