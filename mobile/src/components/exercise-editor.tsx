// One exercise card on the Log form: which exercise, its sets, and notes.
import { useRef, useState, type ComponentRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useStore, type NotesApi } from '../data/store';
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
import { exerciseImage } from '../lib/movement-images';
import { defaultEquipment, exerciseKey, findMovement, type Equipment } from '../lib/movements';
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
import { colors, fonts, hexToRgba, themed } from '../theme';
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
  const { registerExercise, names } = useStore();
  const customNameRef = useRef<TextInputRef>(null);

  const isOther = exercise.name === OTHER_VALUE;
  const category = resolveCategory(exercise, toCategory);
  const accent = category ? category.color : colors.line;
  const isCardio = category?.label === CARDIO_LABEL;
  const exerciseName = isOther ? exercise.customName.trim() : exercise.name;
  const notesEnabled = !!notesApi;
  const movement = isOther ? undefined : findMovement(exercise.name);
  const choices = movement?.equipment ?? [];
  const equipment = exercise.equipment ?? null;
  // Our own picture for the 75 movements; the gold-free stand-in for anything added.
  const picture = exerciseImage(isOther ? exercise.customName : exercise.name);
  /** Buttons when there is something to choose; one fixed kind is just named. */
  const showEquipmentButtons = choices.length > 1 || (!!movement?.optionalEquipment && choices.length === 1);
  const fixedEquipment = choices.length === 1 && !movement?.optionalEquipment ? choices[0] : null;

  const pickEquipment = (e: Equipment) => {
    tapLight();
    // The assisted machine can be switched off again; the others just switch.
    const next = movement?.optionalEquipment && equipment === e ? null : e;
    onChange({ ...exercise, equipment: next });
  };
  const hasToolbar = !!category || !!drag || canMoveUp || canMoveDown || showRemove;

  const pickExercise = (name: string) => {
    const cardioNext = toCategory[name]?.label === CARDIO_LABEL;
    onChange({
      ...exercise,
      name,
      // Start on what this person used last time for this movement.
      equipment: defaultEquipment(name, lastPerformance[name]?.equipment ?? null),
      sets: clampSetsForCategory(exercise.sets, cardioNext),
      setsOther: clampSetsForCategory(exercise.setsOther, cardioNext),
    });
  };

  const pickCustom = (startingName: string) => {
    const cardioNext = exercise.customCategory === CARDIO_LABEL;
    onChange({
      ...exercise,
      name: OTHER_VALUE,
      equipment: null,
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

  /** "Save to my list": keep a typed exercise for next time without logging a workout. */
  const typedName = exercise.customName.trim();
  const alreadyListed = groups.find((g) =>
    g.options.some((o) => o.toLowerCase() === typedName.toLowerCase()),
  );
  const saveToList = () => {
    if (!typedName) return;
    tapLight();
    const listed = alreadyListed?.options.find((o) => o.toLowerCase() === typedName.toLowerCase());
    if (!listed) registerExercise(typedName, exercise.customCategory || OTHER_CATEGORY.label);
    // The card now holds the saved exercise, as if it had been picked from the list.
    const name = listed ?? typedName;
    const cardioNext = listed
      ? toCategory[listed]?.label === CARDIO_LABEL
      : exercise.customCategory === CARDIO_LABEL;
    onChange({
      ...exercise,
      name,
      customName: '',
      customCategory: '',
      equipment: listed ? defaultEquipment(listed, lastPerformance[listed]?.equipment ?? null) : null,
      sets: clampSetsForCategory(exercise.sets, cardioNext),
      setsOther: clampSetsForCategory(exercise.setsOther, cardioNext),
    });
  };

  const updateSet =
    (which: 'sets' | 'setsOther') => (setId: string, field: SetField, value: string) =>
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
    const found = history[exerciseKey(exercise.name, equipment)];
    // With no equipment picked, the plain name holds the latest of any kind: only use a matching one.
    const entry = found && (found.equipment ?? null) === equipment ? found : undefined;
    const summary = lastWorkoutSummary(entry, isCardio);
    if (!entry?.sets.length) {
      if (!equipment || !history[exercise.name]) return null;
      return <Text style={styles.lastWorkout}>First time on {equipment}.</Text>;
    }
    return (
      <Text style={styles.lastWorkout}>
        Last time{equipment ? ` on ${equipment}` : ''}: {summary}
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
              accessibilityHint="Hold and drag up or down. The arrows next to this also move the exercise."
            >
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
            style={({ pressed }) => [styles.editList, pressed && { opacity: 0.6 }]}
          >
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
        style={({ pressed }) => [styles.select, pressed && { opacity: 0.7 }]}
      >
        {picture && (
          <Image source={picture} style={styles.picture} accessibilityIgnoresInvertColors />
        )}
        <Text
          style={[styles.selectText, !exercise.name && { color: colors.muted }]}
          numberOfLines={2}
        >
          {isOther
            ? exercise.customName.trim() || 'Add an exercise'
            : exercise.name || 'Choose an exercise'}
        </Text>
        <Icon name="chevron-down" color={colors.muted} />
      </Pressable>

      {showEquipmentButtons && (
        <View
          style={styles.equipment}
          accessibilityRole="radiogroup"
          accessibilityLabel="Equipment"
        >
          <FieldLabel>
            EQUIPMENT
            {movement?.optionalEquipment ? (
              <Text style={styles.optional}> (only if assisted)</Text>
            ) : !equipment ? (
              <Text style={styles.optional}> (pick one)</Text>
            ) : null}
          </FieldLabel>
          <View style={styles.equipmentRow}>
            {choices.map((e) => {
              const on = equipment === e;
              return (
                <Pressable
                  key={e}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Equipment: ${e}`}
                  onPress={() => pickEquipment(e)}
                  style={({ pressed }) => [
                    styles.equipmentChip,
                    on && styles.equipmentChipOn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.equipmentText, on && styles.equipmentTextOn]}>{e}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {!!fixedEquipment && (
        <Text style={styles.target}>
          Equipment: <Text style={styles.targetValue}>{fixedEquipment}</Text>
        </Text>
      )}

      {isOther && (
        <>
          <TextInput
            ref={customNameRef}
            style={styles.textInput}
            placeholder="Type exercise name"
            placeholderTextColor={colors.placeholder}
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
            accessibilityLabel="Category"
          >
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
                  style={[styles.catChip, { borderColor: color }, on && { backgroundColor: color }]}
                >
                  <Text style={[styles.catChipText, { color: on ? colors.white : color }]}>
                    {cat || 'Other'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <SmallButton
            gold
            icon={alreadyListed ? 'check' : 'content-save-outline'}
            label={alreadyListed ? 'Use the one on my list' : 'Save to my list'}
            disabled={!typedName}
            onPress={saveToList}
            style={styles.saveToList}
          />
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
            <Text style={[styles.person, { color: USER_COLORS[currentUser] }]}>{names[currentUser]}</Text>
          )}
          {lastWorkout(lastPerformance)}
          {notesApi && (
            <SavedNotesList api={notesApi} user={currentUser} exerciseName={exerciseName} />
          )}
          <SetRows
            sets={exercise.sets}
            cardio={isCardio}
            accent={accent === colors.line ? colors.muted : accent}
            who={togetherMode ? names[currentUser] : undefined}
            onChange={updateSet('sets')}
          />

          {togetherMode && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.person, { color: USER_COLORS[otherUser] }]}>{names[otherUser]}</Text>
              {lastWorkout(lastPerformanceOther)}
              {notesApi && (
                <SavedNotesList api={notesApi} user={otherUser} exerciseName={exerciseName} />
              )}
              <SetRows
                sets={exercise.setsOther}
                cardio={isCardio}
                accent={accent === colors.line ? colors.muted : accent}
                who={names[otherUser]}
                onChange={updateSet('setsOther')}
              />
            </>
          )}

          <View style={styles.notes}>
            <FieldLabel>
              {notesEnabled ? 'ADD A NOTE' : 'NOTES'}{' '}
              <Text style={styles.optional}>(optional)</Text>
            </FieldLabel>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder="Form cues, how it felt, anything to remember..."
              placeholderTextColor={colors.placeholder}
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
                  savingNote
                    ? 'Saving...'
                    : togetherMode
                      ? `Save Note for ${names[currentUser]}`
                      : 'Save Note'
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
                onChangeText={(v) =>
                  onChange(s.id, 'intensity', sanitizeIntensityInput(v, s.intensity))
                }
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

const styles = themed(() => StyleSheet.create({
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
    backgroundColor: colors.tint,
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
    backgroundColor: colors.field,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  selectText: { flex: 1, fontSize: 18, fontWeight: '600', color: colors.text },
  picture: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.line,
  },
  equipment: { marginBottom: 10 },
  equipmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  equipmentChip: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.strong,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  equipmentChipOn: { backgroundColor: colors.strong },
  equipmentText: { fontSize: 18, fontWeight: '700', color: colors.text },
  equipmentTextOn: { color: colors.onStrong },
  textInput: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.field,
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
    backgroundColor: colors.field,
  },
  catChipText: { fontSize: 14, fontWeight: '700' },
  saveToList: { alignSelf: 'flex-start', marginBottom: 10 },
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
  setIndex: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setIndexText: { color: colors.onGold, fontFamily: fonts.headingBold, fontSize: 16 },
  notes: { marginTop: 14, gap: 6 },
  optional: { fontFamily: undefined, fontWeight: '400', letterSpacing: 0, fontSize: 13 },
  notesInput: { minHeight: 64, fontSize: 15, marginBottom: 2, textAlignVertical: 'top' },
}));
