// Bring a workout history in from Hevy or Strong: choose their export file,
// see what was found, then add it.
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { pickTextFile } from '../data/files';
import { useStore } from '../data/store';
import { buzzSuccess } from '../lib/haptics';
import { importWorkouts, type ImportResult, type ImportUnit } from '../lib/transfer';
import { formatDate } from '../lib/workout-data';
import { colors, themed } from '../theme';
import { Sheet } from './sheet';
import { OutlineButton, PrimaryButton, UnitToggle } from './ui';

export function ImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { importHistory, prefs } = useStore();
  const [text, setText] = useState<string | null>(null);
  const [unit, setUnit] = useState<ImportUnit>(prefs.weightUnit);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ added: number; already: number } | null>(null);

  const found: ImportResult | null = text ? importWorkouts(text, unit) : null;

  const close = () => {
    setText(null);
    setProblem(null);
    setDone(null);
    onClose();
  };

  const choose = async () => {
    setProblem(null);
    setDone(null);
    try {
      const file = await pickTextFile();
      if (!file) return;
      if (!importWorkouts(file.text)) {
        setText(null);
        setProblem(
          `"${file.name}" is not a workout export from Hevy or Strong. Export your workouts from that app as a CSV file and choose that file.`,
        );
        return;
      }
      setText(file.text);
    } catch {
      setProblem("That file couldn't be opened. Try saving it to Files first, then choose it from there.");
    }
  };

  const add = async () => {
    if (!found || busy) return;
    setBusy(true);
    const result = await importHistory(found.workouts, found.keptNames);
    setBusy(false);
    if (!result) {
      setProblem("The workouts couldn't be saved to this phone. Nothing was added.");
      return;
    }
    buzzSuccess();
    setText(null);
    setDone(result);
  };

  return (
    <Sheet visible={visible} title="Bring In Workouts" onClose={close} closeLabel="Done">
      <ScrollView contentContainerStyle={styles.content}>
        {done ? (
          <View style={styles.card}>
            <Text style={styles.big}>
              {done.added === 1 ? '1 workout added.' : `${done.added} workouts added.`}
            </Text>
            {done.already > 0 && (
              <Text style={styles.body}>
                {done.already} {done.already === 1 ? 'was' : 'were'} already here and left alone.
              </Text>
            )}
            <Text style={styles.body}>They are in History, and they count in Stats and your records.</Text>
          </View>
        ) : found ? (
          <View style={styles.card}>
            <Text style={styles.big}>
              {found.workouts.length} {found.workouts.length === 1 ? 'workout' : 'workouts'} from {found.source}
            </Text>
            <Text style={styles.body}>
              {found.firstDate === found.lastDate
                ? formatDate(found.firstDate)
                : `${formatDate(found.firstDate)} to ${formatDate(found.lastDate)}`}
            </Text>
            <Text style={styles.body}>
              {found.matchedCount} {found.matchedCount === 1 ? 'exercise matches' : 'exercises match'} ours.
              {found.keptNames.length > 0 &&
                ` ${found.keptNames.length} ${found.keptNames.length === 1 ? 'keeps its' : 'keep their'} own name and ${found.keptNames.length === 1 ? 'is' : 'are'} added to your exercise list: ${found.keptNames.slice(0, 6).join(', ')}${found.keptNames.length > 6 ? ' and more' : ''}.`}
            </Text>
            {found.needsUnit && (
              <View style={styles.unitRow}>
                <Text style={styles.unitLabel}>Weights in this file are in</Text>
                <UnitToggle options={['lbs', 'kg'] as const} value={unit} onChange={setUnit} />
              </View>
            )}
            <Text style={styles.hint}>
              Nothing already in the app is changed. Bringing in the same file twice adds nothing new.
            </Text>
            <PrimaryButton
              label={busy ? 'ADDING...' : `ADD ${found.workouts.length} ${found.workouts.length === 1 ? 'WORKOUT' : 'WORKOUTS'}`}
              disabled={busy}
              onPress={add}
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>
              Switching from Hevy or Strong? Bring your history with you.
            </Text>
            <Text style={styles.step}>1. In that app, open Settings and export your workouts as a CSV file.</Text>
            <Text style={styles.step}>2. Save the file to your phone, or email it to yourself and save it.</Text>
            <Text style={styles.step}>3. Choose the file here.</Text>
          </View>
        )}
        {problem && (
          <Text style={styles.problem} accessibilityRole="alert">
            {problem}
          </Text>
        )}
        {!found && <OutlineButton label={done ? 'Choose another file' : 'Choose the file'} onPress={choose} />}
        {found && <OutlineButton label="Choose a different file" onPress={choose} />}
      </ScrollView>
    </Sheet>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  big: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, lineHeight: 23, color: colors.text },
  step: { fontSize: 16, lineHeight: 23, color: colors.muted },
  hint: { fontSize: 14, lineHeight: 20, color: colors.muted },
  unitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  unitLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  problem: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.danger },
}));
