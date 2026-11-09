// The exercise list as a native sheet: search at the top, exercises grouped
// by colour-coded category, and "type your own" for anything not listed.
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { tapLight } from '../lib/haptics';
import { OTHER_VALUE, type ExerciseGroup } from '../lib/workout-data';
import { colors, fonts } from '../theme';
import { Sheet } from './sheet';
import { Dot, Icon } from './ui';

type Props = {
  visible: boolean;
  groups: ExerciseGroup[];
  /** The exercise currently chosen ("" for none). */
  selected: string;
  onPick: (name: string) => void;
  /** "Type your own", optionally starting from what was searched for. */
  onPickCustom: (startingName: string) => void;
  onManage?: () => void;
  onClose: () => void;
};

export function ExercisePicker({
  visible,
  groups,
  selected,
  onPick,
  onPickCustom,
  onManage,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const sections = useMemo(
    () =>
      groups
        .map((g) => ({
          title: g.label,
          color: g.color,
          data: q ? g.options.filter((o) => o.toLowerCase().includes(q)) : g.options,
        }))
        .filter((s) => s.data.length),
    [groups, q],
  );

  const exactMatch = groups.some((g) => g.options.some((o) => o.toLowerCase() === q));
  const close = () => {
    setSearch('');
    onClose();
  };

  return (
    <Sheet visible={visible} title="Choose an exercise" onClose={close}>
      <View style={styles.searchRow}>
        <Icon name="magnify" color={colors.muted} />
        <TextInput
          style={styles.search}
          placeholder="Search exercises"
          placeholderTextColor="#a3a59a"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="words"
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search exercises"
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled
        initialNumToRender={24}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.custom, pressed && styles.pressed]}
            onPress={() => {
              tapLight();
              onPickCustom(exactMatch ? '' : search.trim());
              close();
            }}>
            <Icon name="plus" color={colors.goldDeep} />
            <Text style={styles.customText}>
              {q && !exactMatch ? `Add "${search.trim()}" as a new exercise` : 'Other (type your own)'}
            </Text>
          </Pressable>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Dot color={section.color} />
            <Text style={[styles.sectionTitle, { color: section.color }]}>
              {section.title.toUpperCase()}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isSelected = item === selected;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                tapLight();
                onPick(item);
                close();
              }}>
              <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{item}</Text>
              {isSelected && <Icon name="check" color={colors.goldDeep} />}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No exercises match &quot;{search.trim()}&quot;.</Text>
        }
        ListFooterComponent={
          onManage ? (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.manage, pressed && styles.pressed]}
              onPress={() => {
                close();
                onManage();
              }}>
              <Icon name="pencil-outline" size={16} color={colors.goldDeep} />
              <Text style={styles.manageText}>Edit this list</Text>
            </Pressable>
          ) : undefined
        }
      />
    </Sheet>
  );
}

export { OTHER_VALUE };

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  search: { flex: 1, minHeight: 48, fontSize: 17, color: colors.text },
  listContent: { paddingBottom: 40 },
  custom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    marginHorizontal: 18,
    marginVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,162,39,0.1)',
  },
  customText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: colors.bg,
  },
  sectionTitle: { fontFamily: fonts.headingBold, fontSize: 14, letterSpacing: 0.8 },
  row: {
    minHeight: 50,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowText: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 10 },
  rowTextSelected: { fontWeight: '700' },
  pressed: { opacity: 0.6 },
  empty: { textAlign: 'center', color: colors.muted, fontSize: 15, padding: 24 },
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    marginTop: 12,
  },
  manageText: { fontSize: 15, fontWeight: '700', color: colors.goldDeep },
});
