// Edit a plan: its name and its exercises (add, remove, drag to reorder).
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useStore } from '../data/store';
import {
  draftToTemplateExercises,
  emptyExercise,
  finalName,
  resolveCategory,
  templateToDraft,
  type DraftExercise,
} from '../lib/draft';
import { buzzSuccess, tapLight } from '../lib/haptics';
import { moveToIndex } from '../lib/reorder';
import type { WorkoutTemplate } from '../lib/types';
import { OTHER_CATEGORY, OTHER_VALUE } from '../lib/workout-data';
import { moveItem } from '../lib/workout-helpers';
import { colors } from '../theme';
import { ExerciseEditor } from './exercise-editor';
import { KeyboardScroll } from './keyboard-scroll';
import { ManageExercisesSheet } from './manage-exercises';
import { Sheet } from './sheet';
import { SortableList, useScrollBridge } from './sortable-list';
import { FieldLabel, OutlineButton, PrimaryButton } from './ui';

export function PlanEditorSheet({
  template,
  onClose,
}: {
  /** The plan being edited, or null when the sheet is closed. */
  template: WorkoutTemplate | null;
  onClose: () => void;
}) {
  return (
    <Sheet visible={!!template} title="Edit Plan" onClose={onClose} closeLabel="Cancel">
      {template && <PlanEditorBody key={template.id} template={template} onClose={onClose} />}
    </Sheet>
  );
}

function PlanEditorBody({ template, onClose }: { template: WorkoutTemplate; onClose: () => void }) {
  const { groups, toCategory, saveTemplateEdits, registerExercise } = useStore();
  const [name, setName] = useState(template.name);
  const [exercises, setExercises] = useState<DraftExercise[]>(() =>
    templateToDraft(template.exercises, toCategory),
  );
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState(false);
  const { bridge, scrollProps, hostProps, overlay } = useScrollBridge();

  const canSave = name.trim().length > 0 && exercises.some((ex) => finalName(ex));

  const save = async () => {
    const built = draftToTemplateExercises(exercises);
    if (!built.length) return;
    setSaving(true);
    const ok = await saveTemplateEdits(template.id, name.trim(), built);
    setSaving(false);
    if (!ok) return;
    // Remember new exercises typed in here, with the category picked.
    exercises
      .filter((ex) => ex.name === OTHER_VALUE && ex.customName.trim())
      .forEach((ex) =>
        registerExercise(ex.customName.trim(), ex.customCategory || OTHER_CATEGORY.label),
      );
    buzzSuccess();
    onClose();
  };

  return (
    <View {...hostProps}>
      <KeyboardScroll {...scrollProps}>
        <View style={styles.nameRow}>
          <FieldLabel>PLAN NAME</FieldLabel>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            accessibilityLabel="Plan name"
          />
        </View>

        <SortableList
          data={exercises}
          keyExtractor={(ex) => ex.id}
          scroll={bridge}
          ghostFor={(ex) => ({
            title: finalName(ex) || 'New exercise',
            color: resolveCategory(ex, toCategory)?.color ?? colors.muted,
          })}
          onMove={(from, to) => setExercises((prev) => moveToIndex(prev, from, to))}
          renderItem={(ex, i, drag) => (
            <ExerciseEditor
              exercise={ex}
              onChange={(updated) =>
                setExercises((prev) => prev.map((e) => (e.id === ex.id ? updated : e)))
              }
              onRemove={() => setExercises((prev) => prev.filter((e) => e.id !== ex.id))}
              showRemove={exercises.length > 1}
              onMoveUp={() => setExercises((prev) => moveItem(prev, i, -1))}
              onMoveDown={() => setExercises((prev) => moveItem(prev, i, 1))}
              canMoveUp={i > 0}
              canMoveDown={i < exercises.length - 1}
              drag={exercises.length > 1 ? drag : undefined}
              groups={groups}
              toCategory={toCategory}
              lastPerformance={{}}
              lastPerformanceOther={{}}
              togetherMode={false}
              currentUser="Diego"
              otherUser="Kevin"
              hideSets
              onManageExercises={() => setManaging(true)}
            />
          )}
        />

        <OutlineButton
          icon="plus"
          label="Add Exercise"
          style={styles.addBtn}
          onPress={() => {
            tapLight();
            setExercises((prev) => [...prev, emptyExercise()]);
          }}
        />
        <PrimaryButton
          label={saving ? 'SAVING...' : 'SAVE PLAN'}
          disabled={!canSave || saving}
          onPress={save}
        />
      </KeyboardScroll>
      {overlay}
      <ManageExercisesSheet visible={managing} onClose={() => setManaging(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  nameRow: { gap: 8, marginBottom: 18 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
  },
  addBtn: {
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    minHeight: 56,
    marginBottom: 18,
  },
});
