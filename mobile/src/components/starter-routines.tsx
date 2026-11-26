// Ready-made routines a customer can add with one tap, so a new app is not empty.
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { STARTER_ROUTINES } from '../data/sample-data';
import { useStore } from '../data/store';
import { buzzSuccess } from '../lib/haptics';
import { exerciseLabel } from '../lib/movements';
import { PLAN_LIMIT_MESSAGE, PLAN_LIMIT_TITLE } from '../lib/pro';
import { colors, themed } from '../theme';
import { useGoPro } from './go-pro';
import { Sheet } from './sheet';
import { SmallButton } from './ui';

export function StarterRoutinesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { db, createRoutine, canAddRoutine } = useStore();
  const goPro = useGoPro();
  const have = new Set(db.templates.map((t) => t.name.toLowerCase()));

  const add = async (name: string) => {
    const starter = STARTER_ROUTINES.find((s) => s.name === name);
    if (!starter) return;
    if (!canAddRoutine) {
      void goPro.offer(PLAN_LIMIT_TITLE, PLAN_LIMIT_MESSAGE);
      return;
    }
    if (await createRoutine(starter.name, starter.exercises)) buzzSuccess();
  };

  return (
    <Sheet visible={visible} title="Starter Routines" onClose={onClose} closeLabel="Done">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Add one and change anything you like: the exercises, the order, the name.
        </Text>
        {STARTER_ROUTINES.map((s) => {
          const added = have.has(s.name.toLowerCase());
          return (
            <View key={s.name} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.name}>{s.name}</Text>
                <SmallButton
                  gold={!added}
                  icon={added ? 'check' : 'plus'}
                  label={added ? `${s.name} added` : `Add ${s.name}`}
                  disabled={added}
                  onPress={() => add(s.name)}
                />
              </View>
              <Text style={styles.list}>
                {s.exercises.map((e) => exerciseLabel(e.name, e.equipment)).join(', ')}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      {goPro.sheet}
    </Sheet>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
  lead: { fontSize: 16, lineHeight: 22, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontSize: 19, fontWeight: '700', color: colors.text },
  list: { fontSize: 15, lineHeight: 21, color: colors.muted },
}));
