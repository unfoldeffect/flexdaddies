// Log: one drop-down box for routines (Diego, Nov. 26, 2026), in place of the
// row of routine pills. It opens a list: tap a routine to start it, the pencil
// to edit it, the X to delete it; New routine and Starter routines at the bottom.
// The box stops short of the right edge, where the rest timer floats.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { WorkoutTemplate } from '../lib/types';
import { plural } from '../lib/words';
import { colors, fonts, themed } from '../theme';
import { Sheet } from './sheet';
import { Icon, OutlineButton } from './ui';

/** Room left on the right for the rest timer (its size plus a gap). */
export const TIMER_ROOM = 96;

export function RoutinePicker({
  templates,
  current,
  onStart,
  onEdit,
  onDelete,
  onNew,
  onStarters,
}: {
  templates: WorkoutTemplate[];
  /** The routine the workout on screen was started from, if any. */
  current: string | null;
  onStart: (t: WorkoutTemplate) => void;
  onEdit: (t: WorkoutTemplate) => void;
  /** Resolves once the person has answered (the list stays open). */
  onDelete: (t: WorkoutTemplate) => Promise<void> | void;
  onNew: () => void;
  onStarters: () => void;
}) {
  const [open, setOpen] = useState(false);

  // A second sheet can only open once this one has closed (iPhone rule).
  const closeThen = (next: () => void) => {
    setOpen(false);
    setTimeout(next, 450);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>ROUTINE</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose a routine"
        accessibilityValue={current ? { text: current } : undefined}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.select, pressed && styles.pressed]}
      >
        <Icon name="dumbbell" size={18} color={colors.muted} />
        <Text style={[styles.selectText, !current && styles.placeholder]} numberOfLines={1}>
          {current ?? 'Choose a routine'}
        </Text>
        <Icon name="chevron-down" color={colors.muted} />
      </Pressable>

      <Sheet visible={open} title="Routines" onClose={() => setOpen(false)}>
        <ScrollView contentContainerStyle={styles.list}>
          {templates.map((t) => (
            <View key={t.id} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Start from routine ${t.name}`}
                onPress={() => closeThen(() => onStart(t))}
                style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
              >
                <Text style={styles.rowName} numberOfLines={2}>
                  {t.name}
                </Text>
                <Text style={styles.rowSub}>{plural(t.exercises.length, 'exercise')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${t.name} routine`}
                hitSlop={8}
                onPress={() => closeThen(() => onEdit(t))}
                style={({ pressed }) => [styles.rowIcon, pressed && styles.pressed]}
              >
                <Icon name="pencil-outline" size={22} color={colors.muted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${t.name} routine`}
                hitSlop={8}
                onPress={() => void onDelete(t)}
                style={({ pressed }) => [styles.rowIcon, pressed && styles.pressed]}
              >
                <Icon name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ))}
          <View style={styles.footer}>
            <OutlineButton icon="plus" label="New routine" onPress={() => closeThen(onNew)} />
            <OutlineButton label="Starter routines" onPress={() => closeThen(onStarters)} />
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { marginBottom: 16, marginRight: TIMER_ROOM },
  label: {
    fontFamily: fonts.headingBold,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.muted,
    marginBottom: 8,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selectText: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  placeholder: { color: colors.muted },
  pressed: { opacity: 0.6 },
  list: { paddingHorizontal: 18, paddingBottom: 40, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowMain: { flex: 1, paddingVertical: 10, gap: 2 },
  rowName: { fontSize: 18, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 14, color: colors.muted },
  rowIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 10, marginTop: 8 },
}));
