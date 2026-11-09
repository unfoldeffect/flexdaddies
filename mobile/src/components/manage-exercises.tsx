// "Manage Exercises": rename, recategorise, remove and restore exercises.
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useStore } from '../data/store';
import { confirm } from '../lib/dialogs';
import { buzzSuccess, buzzWarning, tapLight } from '../lib/haptics';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  OTHER_CATEGORY,
  type ManagedExercise,
} from '../lib/workout-data';
import { colors, fonts } from '../theme';
import { Sheet } from './sheet';
import { Dot, Icon, IconButton, OutlineButton, SmallButton } from './ui';

const keyOf = (ex: ManagedExercise) => ex.builtinOriginal ?? `custom:${ex.name}`;
const CATEGORIES = [...CATEGORY_LABELS, OTHER_CATEGORY.label];

type Row = { ex: ManagedExercise; hidden: boolean };

export function ManageExercisesSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { managed, updateManagedExercise, removeManagedExercise, restoreManagedExercise } =
    useStore();
  const [search, setSearch] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = search.trim().toLowerCase();
  const sections = useMemo(() => {
    const visibleRows = managed.filter((ex) => !ex.hidden && ex.name.toLowerCase().includes(q));
    const hiddenRows = managed.filter((ex) => ex.hidden && ex.name.toLowerCase().includes(q));
    const out: { title: string; color: string; data: Row[] }[] = CATEGORIES.map((label) => ({
      title: label,
      color: CATEGORY_COLORS[label] ?? OTHER_CATEGORY.color,
      data: visibleRows.filter((ex) => ex.category === label).map((ex) => ({ ex, hidden: false })),
    })).filter((s) => s.data.length);
    if (hiddenRows.length) {
      out.push({
        title: 'Removed from list',
        color: colors.muted,
        data: hiddenRows.map((ex) => ({ ex, hidden: true })),
      });
    }
    return out;
  }, [managed, q]);

  const startEdit = (ex: ManagedExercise) => {
    setEditingKey(keyOf(ex));
    setEditName(ex.name);
    setEditCategory(ex.category);
    setEditError(null);
  };

  const saveEdit = async (ex: ManagedExercise) => {
    const name = editName.trim();
    if (!name) return;
    const clash = managed.find(
      (m) => keyOf(m) !== keyOf(ex) && m.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) {
      setEditError(`"${clash.name}" is already on the list.`);
      return;
    }
    if (
      name !== ex.name &&
      !(await confirm({
        title: `Rename "${ex.name}" to "${name}"?`,
        message: 'Past workouts, plans and notes will use the new name.',
        confirmLabel: 'Rename',
      }))
    ) {
      return;
    }
    setBusy(true);
    const ok = await updateManagedExercise(ex, name, editCategory);
    setBusy(false);
    if (ok) {
      buzzSuccess();
      setEditingKey(null);
    }
  };

  const remove = async (ex: ManagedExercise) => {
    buzzWarning();
    if (
      await confirm({
        title: `Remove "${ex.name}" from the exercise list?`,
        message: 'Your logged workouts with it stay in History.',
        confirmLabel: 'Remove',
        destructive: true,
      })
    ) {
      void removeManagedExercise(ex);
    }
  };

  return (
    <Sheet visible={visible} title="Manage Exercises" onClose={onClose} closeLabel="Done">
      <Text style={styles.sub}>
        Edit or remove exercises from the list. Removing one never deletes your logged workouts.
      </Text>
      <View style={styles.searchRow}>
        <Icon name="magnify" color={colors.muted} />
        <TextInput
          style={styles.search}
          placeholder="Search exercises..."
          placeholderTextColor="#a3a59a"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search exercises"
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(row) => keyOf(row.ex)}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        stickySectionHeadersEnabled
        initialNumToRender={20}
        extraData={[editingKey, editName, editCategory, editError, busy]}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: section.color }]}>
              {section.title.toUpperCase()}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.sub}>No exercises match &quot;{search.trim()}&quot;.</Text>
        }
        renderItem={({ item: { ex, hidden } }) => {
          if (hidden) {
            return (
              <View style={[styles.row, { opacity: 0.75 }]}>
                <Text style={[styles.name, { color: colors.muted }]}>{ex.name}</Text>
                <OutlineButton
                  compact
                  label="Restore"
                  accessibilityLabel={`Restore ${ex.name}`}
                  onPress={() => {
                    tapLight();
                    void restoreManagedExercise(ex);
                  }}
                />
              </View>
            );
          }
          if (editingKey === keyOf(ex)) {
            return (
              <View style={styles.edit}>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={(text) => {
                    setEditName(text);
                    setEditError(null);
                  }}
                  autoFocus
                  autoCapitalize="words"
                  accessibilityLabel="Exercise name"
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  automaticallyAdjustKeyboardInsets
                  contentContainerStyle={styles.catChips}
                >
                  {CATEGORIES.map((c) => {
                    const on = editCategory === c;
                    const color = CATEGORY_COLORS[c] ?? OTHER_CATEGORY.color;
                    return (
                      <Pressable
                        key={c}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`Category: ${c}`}
                        onPress={() => {
                          tapLight();
                          setEditCategory(c);
                        }}
                        style={[
                          styles.catChip,
                          { borderColor: color },
                          on && { backgroundColor: color },
                        ]}
                      >
                        <Text style={[styles.catChipText, { color: on ? colors.white : color }]}>
                          {c}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {!!editError && <Text style={styles.error}>{editError}</Text>}
                <View style={styles.editActions}>
                  <SmallButton
                    label={busy ? 'Saving...' : 'Save'}
                    disabled={busy || !editName.trim()}
                    onPress={() => saveEdit(ex)}
                  />
                  <OutlineButton compact label="Cancel" onPress={() => setEditingKey(null)} />
                </View>
              </View>
            );
          }
          return (
            <View style={styles.row}>
              <Dot color={ex.color} size={10} />
              <Text style={styles.name}>{ex.name}</Text>
              <IconButton
                icon="pencil-outline"
                label={`Edit ${ex.name}`}
                size={38}
                iconSize={17}
                color={colors.ink}
                onPress={() => startEdit(ex)}
              />
              <IconButton
                icon="trash-can-outline"
                label={`Remove ${ex.name}`}
                size={38}
                iconSize={17}
                color={colors.danger}
                onPress={() => remove(ex)}
              />
            </View>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 15, color: colors.muted, paddingHorizontal: 18, marginBottom: 10 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  search: { flex: 1, minHeight: 48, fontSize: 17, color: colors.text },
  listContent: { paddingBottom: 40 },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: colors.bg,
  },
  sectionTitle: { fontFamily: fonts.headingBold, fontSize: 14, letterSpacing: 0.8 },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  name: { flex: 1, fontSize: 16, color: colors.text },
  edit: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    gap: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
  },
  catChips: { gap: 8, paddingRight: 8 },
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
  error: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  editActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
