// One exercise card on the Log form: which exercise, its sets, and notes.
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { NotesApi } from '../data/store';
import {
  clampSetsForCategory,
  lastWorkoutSummary,
  resolveCategory,
  sanitizeIntensityInput,
  sanitizeWholeNumberInput,
  type DraftExercise,
  type DraftSet,
  type SetField,
  type ToCategory,
} from '../lib/draft';
import { tapLight } from '../lib/haptics';
import type { WorkoutExercise } from '../lib/types';
import {
  CARDIO_LABEL,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  OTHER_CATEGORY,
  OTHER_VALUE,
  USER_COLORS,
  type ExerciseGroup,
  type WorkoutUser,
} from '../lib/workout-data';
import { sanitizeWeightInput } from '../lib/workout-helpers';
import { colors, fonts, hexToRgba } from '../theme';
import { ExercisePicker } from './exercise-picker';
import { NumberField } from './number-field';
import { SavedNotesList } from './saved-notes';
import type { DragControls } from './sortable-list';
import { Dot, FieldLabel, Icon, IconButton, SmallButton } from './ui';

type History = Record<string, WorkoutExercise>;
type TextInputRef = ComponentRef<typeof TextInput>;

type Props = {
  exercise: DraftExercise;
  onChange: (updated: DraftExercise) => void;
  onRemove: () => void;
  showRemove: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** Present when the card can be dragged to a new place. */
  drag?: DragControls;
  groups: ExerciseGroup[];
  toCategory: ToCategory;
  lastPerformance: History;
  lastPerformanceOther: History;
  togetherMode: boolean;
  currentUser: WorkoutUser;
  otherUser: WorkoutUser;
  /** Plan editor: only the exercise is chosen, no sets or notes. */
  hideSets?: boolean;
  /** Log tab: notes go to the saved notes list. */
  notesApi?: NotesApi | null;
  onManageExercises?: () => void;
};

export function ExerciseEditor({
  exercise,
  onChange,
  onRemove,
  showRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  drag,
  groups,
  toCategory,
  lastPerformance,
  lastPerformanceOther,
  togetherMode,
  currentUser,
  otherUser,
  hideSets = false,
  notesApi = null,
  onManageExercises,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const customNameRef = useRef<TextInputRef>(null);

  const isOther = exercise.name === OTHER_VALUE;
  const category = resolveCategory(exercise, toCategory);
  const accent = category ? category.color : colors.line;
  const isCardio = category?.label === CARDIO_LABEL;
  const exerciseName = isOther ? exercise.customName.trim() : exercise.name;
  const notesEnabled = !!notesApi;
  const hasToolbar = !!category || !!drag || canMoveUp || canMoveDown || showRemove;

  const pickExercise = (name: string) => {
    const cardioNext = toCategory[name]?.label === CARDIO_LABEL;
    onChange({
      ...exercise,
      name,
      sets: clampSetsForCategory(exercise.sets, cardioNext),
      setsOther: clampSetsForCategory(exercise.setsOther, cardioNext),
    });
  };

  const pickCustom = (startingName: string) => {
    const cardioNext = exercise.customCategory === CARDIO_LABEL;
    onChange({
      ...exercise,
      name: OTHER_VALUE,
      customName: startingName || exercise.customName,
      sets: clampSetsForCategory(exercise.sets, cardioNext),
      setsOther: clampSetsForCategory(exercise.setsOther, cardioNext),
    });
    if (!startingName) setTimeout(() => customNameRef.current?.focus(), 450);
  };

  const pickCustomCategory = (cat: string) => {
    const cardioNext = cat === CARDIO_LABEL;
    tapLight();
    onChange({
      ...exercise,
      customCategory: cat,
      sets: clampSetsForCategory(exercise.sets, cardioNext),
      setsOther: clampSetsForCategory(exercise.setsOther, cardioNext),
    });
  };

  const updateSet = (which: 'sets' | 'setsOther') => (setId: string, field: SetField, value: string) =>
    onChange({
      ...exercise,
      [which]: exercise[which].map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
    });

  const saveNote = async () => {
    const text = exercise.notes.trim();
    if (!notesApi || !text || !exerciseName) return;
    setSavingNote(true);
    const ok = await notesApi.add(currentUser, exerciseName, text);
    setSavingNote(false);
    if (ok) {
      onChange({ ...exercise, notes: '', sessionNotes: [...(exercise.sessionNotes ?? []), text] });
    }
  };

  const lastWorkout = (history: History) => {
    if (isOther || !exercise.name) return null;
    const entry = history[exercise.name];
    const summary = lastWorkoutSummary(entry, isCardio);
    if (!entry?.sets.length) return null;
    return (
      <Text style={styles.lastWorkout}>
        Last workout: {summary}
        {!notesEnabled && !!entry.notes && (
          <Text style={styles.lastWorkoutQuote}>
            {'\n'}&quot;{entry.notes}&quot;
          </Text>
        )}
      </Text>
    );
  };

  return (
    <View style={[styles.card, category && { borderColor: accent }]}>
      <View style={[styles.toolbar, !hasToolbar && styles.toolbarEmpty]}>
        {category ? (
          <View style={[styles.categoryTile, { backgroundColor: hexToRgba(category.color, 0.14) }]}>
            <Dot color={category.color} />
            <Text style={[styles.categoryText, { color: category.color }]}>{category.label}</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.tools}>
          {drag?.handle(
            <View
              style={styles.grip}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Drag to reorder"
              accessibilityHint="Hold and drag up or down. The arrows next to this also move the exercise.">
              <Icon name="drag-horizontal-variant" size={24} color={colors.muted} />
            </View>,
          )}
          {(canMoveUp || canMoveDown) && (
            <>
              <IconButton
                icon="chevron-up"
                label="Move exercise up"
                size={40}
                style={styles.moveBtn}
                disabled={!canMoveUp}
                onPress={() => {
                  tapLight();
                  onMoveUp?.();
                }}
              />
              <IconButton
                icon="chevron-down"
                label="Move exercise down"
                size={40}
                style={styles.moveBtn}
                disabled={!canMoveDown}
                onPress={() => {
                  tapLight();
                  onMoveDown?.();
                }}
              />
            </>
          )}
          {showRemove && (
            <IconButton icon="close" label="Remove exercise" size={40} onPress={onRemove} />
          )}
        </View>
      </View>

      <View style={styles.labelRow}>
        <FieldLabel>EXERCISE</FieldLabel>
        {onManageExercises && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit the exercise list"
            hitSlop={12}
            onPress={onManageExercises}
            style={({ pressed }) => [styles.editList, pressed && { opacity: 0.6 }]}>
            <Icon name="pencil-outline" size={14} color={colors.goldDeep} />
            <Text style={styles.editListText}>Edit list</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          exerciseName ? `Exercise: ${exerciseName}. Tap to change.` : 'Choose an exercise'
        }
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [styles.select, pressed && { opacity: 0.7 }]}>
        <Text style={[styles.selectText, !exercise.name && { color: colors.muted }]} numberOfLines={2}>
          {isOther ? 'Other (type your own)' : exercise.name || 'Choose an exercise'}
        </Text>
        <Icon name="chevron-down" color={colors.muted} />
      </Pressable>

      {isOther && (
        <>
          <TextInput
            ref={customNameRef}
            style={styles.textInput}
            placeholder="Type exercise name"
            placeholderTextColor="#a3a59a"
            value={exercise.customName}
            onChangeText={(customName) => onChange({ ...exercise, customName })}
            autoCapitalize="words"
            returnKeyType="done"
            accessibilityLabel="Exercise name"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.catChips}
            accessibilityRole="radiogroup"
            accessibilityLabel="Category">
            {['', ...CATEGORY_LABELS].map((cat) => {
              const on = exercise.customCategory === cat;
              const color = cat ? CATEGORY_COLORS[cat] : OTHER_CATEGORY.color;
              return (
                <Pressable
                  key={cat || 'other'}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Category: ${cat || 'Other'}`}
                  onPress={() => pickCustomCategory(cat)}
                  style={[
                    styles.catChip,
                    { borderColor: color },
                    on && { backgroundColor: color },
                  ]}>
                  <Text style={[styles.catChipText, { color: on ? colors.white : color }]}>
                    {cat || 'Other'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {!!exercise.targetReps && (
        <Text style={styles.target}>
          Plan target: <Text style={styles.targetValue}>{exercise.targetReps}</Text>
        </Text>
      )}

      {!hideSets && (
        <>
          {togetherMode && (
            <Text style={[styles.person, { color: USER_COLORS[currentUser] }]}>{currentUser}</Text>
          )}
          {lastWorkout(lastPerformance)}
          {notesApi && <SavedNotesList api={notesApi} user={currentUser} exerciseName={exerciseName} />}
          <SetRows
            sets={exercise.sets}
            cardio={isCardio}
            accent={accent === colors.line ? '#9ca3af' : accent}
            who={togetherMode ? currentUser : undefined}
            onChange={updateSet('sets')}
          />

          {togetherMode && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.person, { color: USER_COLORS[otherUser] }]}>{otherUser}</Text>
              {lastWorkout(lastPerformanceOther)}
              {notesApi && (
                <SavedNotesList api={notesApi} user={otherUser} exerciseName={exerciseName} />
              )}
              <SetRows
                sets={exercise.setsOther}
                cardio={isCardio}
                accent={accent === colors.line ? '#9ca3af' : accent}
                who={otherUser}
                onChange={updateSet('setsOther')}
              />
            </>
          )}

          <View style={styles.notes}>
            <FieldLabel>
              {notesEnabled ? 'ADD A NOTE' : 'NOTES'} <Text style={styles.optional}>(optional)</Text>
            </FieldLabel>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder="Form cues, how it felt, anything to remember..."
              placeholderTextColor="#a3a59a"
              value={exercise.notes}
              onChangeText={(notes) => onChange({ ...exercise, notes })}
              multiline
              accessibilityLabel="Notes for this exercise"
            />
            {notesEnabled && (
              <SmallButton
                gold
                icon="plus"
                label={
                  savingNote ? 'Saving...' : togetherMode ? `Save Note for ${currentUser}` : 'Save Note'
                }
                disabled={savingNote || !exercise.notes.trim() || !exerciseName}
                onPress={saveNote}
              />
            )}
          </View>
        </>
      )}

      <ExercisePicker
        visible={pickerOpen}
        groups={groups}
        selected={isOther ? '' : exercise.name}
        onPick={pickExercise}
        onPickCustom={pickCustom}
        onManage={onManageExercises ? () => setTimeout(onManageExercises, 450) : undefined}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

/** The grid of sets. "Next" on the keyboard walks reps, weight, next set. */
function SetRows({
  sets,
  cardio,
  accent,
  who,
  onChange,
}: {
  sets: DraftSet[];
  cardio: boolean;
  accent: string;
  /** Named in screen-reader labels when two people share the card. */
  who?: string;
  onChange: (setId: string, field: SetField, value: string) => void;
}) {
  const inputs = useRef<(TextInputRef | null)[]>([]);
  const last = sets.length * 2 - 1;
  const fieldProps = (index: number) => ({
    ref: (node: TextInputRef | null) => {
      inputs.current[index] = node;
    },
    returnKeyType: index === last ? ('done' as const) : ('next' as const),
    submitBehavior: index === last ? ('blurAndSubmit' as const) : ('submit' as const),
    onSubmitEditing: () => {
      if (index < last) inputs.current[index + 1]?.focus();
    },
  });
  const prefix = who ? `${who}, ` : '';

  return (
    <View style={styles.setRows}>
      <View style={styles.setRow}>
        <Text style={[styles.setHeader, styles.setIndexCol]}>SET</Text>
        <Text style={[styles.setHeader, styles.setCol]}>{cardio ? 'TIME (MIN)' : 'REPS'}</Text>
        <Text style={[styles.setHeader, styles.setCol]}>
          {cardio ? 'INTENSITY (1-10)' : 'WEIGHT (LBS)'}
        </Text>
      </View>
      {sets.map((s, i) => (
        <View style={styles.setRow} key={s.id}>
          <View style={styles.setIndexCol}>
            <View style={[styles.setIndex, { backgroundColor: accent }]}>
              <Text style={styles.setIndexText}>{i + 1}</Text>
            </View>
          </View>
          {cardio ? (
            <>
              <NumberField
                {...fieldProps(i * 2)}
                style={styles.setCol}
                value={s.time}
                accessibilityLabel={`${prefix}time in minutes`}
                onChangeText={(v) => onChange(s.id, 'time', sanitizeWholeNumberInput(v, s.time))}
              />
              <NumberField
                {...fieldProps(i * 2 + 1)}
                style={styles.setCol}
                value={s.intensity}
                maxLength={2}
                accessibilityLabel={`${prefix}intensity, 1 to 10`}
                onChangeText={(v) => onChange(s.id, 'intensity', sanitizeIntensityInput(v, s.intensity))}
              />
            </>
          ) : (
            <>
              <NumberField
                {...fieldProps(i * 2)}
                style={styles.setCol}
                value={s.reps}
                maxLength={4}
                accessibilityLabel={`${prefix}set ${i + 1} reps`}
                onChangeText={(v) => onChange(s.id, 'reps', sanitizeWholeNumberInput(v, s.reps))}
              />
              <NumberField
                {...fieldProps(i * 2 + 1)}
                decimal
                style={styles.setCol}
                value={s.weight}
                accessibilityLabel={`${prefix}set ${i + 1} weight in lbs`}
                onChangeText={(v) => onChange(s.id, 'weight', sanitizeWeightInput(v, s.weight))}
              />
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: 8,
  },
  toolbarEmpty: { minHeight: 0, marginBottom: 0 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grip: {
    width: 48,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,37,69,0.06)',
  },
  moveBtn: { borderRadius: 12 },
  categoryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: { fontFamily: fonts.headingBold, fontSize: 13, letterSpacing: 0.6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  editList: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editListText: { fontSize: 14, fontWeight: '700', color: colors.goldDeep },
  select: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  selectText: { flex: 1, fontSize: 17, color: colors.text },
  textInput: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  catChips: { gap: 8, paddingBottom: 10, paddingRight: 8 },
  catChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  catChipText: { fontSize: 14, fontWeight: '700' },
  target: { fontSize: 14, color: colors.muted, marginBottom: 8 },
  targetValue: { fontWeight: '700', color: colors.text },
  person: { fontFamily: fonts.headingBold, fontSize: 15, letterSpacing: 0.4, marginBottom: 6 },
  lastWorkout: { fontSize: 14, fontWeight: '600', color: colors.goldNote, marginBottom: 10 },
  lastWorkoutQuote: { fontStyle: 'italic', fontWeight: '500' },
  divider: {
    marginTop: 16,
    marginBottom: 12,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  setRows: { gap: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setIndexCol: { width: 40 },
  setCol: { flex: 1, flexBasis: 0, minWidth: 0 },
  setHeader: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, color: colors.muted },
  setIndex: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  setIndexText: { color: colors.white, fontFamily: fonts.headingBold, fontSize: 16 },
  notes: { marginTop: 14, gap: 6 },
  optional: { fontFamily: undefined, fontWeight: '400', letterSpacing: 0, fontSize: 13 },
  notesInput: { minHeight: 64, fontSize: 15, marginBottom: 2, textAlignVertical: 'top' },
});
