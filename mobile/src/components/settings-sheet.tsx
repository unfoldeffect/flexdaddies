// Settings: rest timer, units, and the data kept on this phone.
import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { REST_CHOICES } from '../data/storage';
import { useStore } from '../data/store';
import { confirm } from '../lib/dialogs';
import { buzzSuccess, buzzWarning, tapLight } from '../lib/haptics';
import { colors, fonts } from '../theme';
import { Sheet } from './sheet';
import { Chip, OutlineButton, UnitToggle } from './ui';

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs, setPrefs, db, hasSample, removeSample, resetToSample, eraseEverything } = useStore();

  const ask = async (
    title: string,
    message: string,
    confirmLabel: string,
    action: () => Promise<boolean>,
  ) => {
    buzzWarning();
    if (await confirm({ title, message, confirmLabel, destructive: true })) {
      if (await action()) buzzSuccess();
    }
  };

  return (
    <Sheet visible={visible} title="Settings" onClose={onClose} closeLabel="Done">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>REST TIMER</Text>
        <View style={styles.card}>
          <Text style={styles.rowLabel}>Rest between sets</Text>
          <View style={styles.chips}>
            {REST_CHOICES.map((s) => (
              <Chip
                key={s}
                label={s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60} min` : `${s}s`}
                active={prefs.restSeconds === s}
                onPress={() => setPrefs({ restSeconds: s })}
                style={styles.chip}
              />
            ))}
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Chime when rest is over</Text>
            <Switch
              value={prefs.restSound}
              onValueChange={(restSound) => {
                tapLight();
                setPrefs({ restSound });
              }}
              trackColor={{ false: colors.line, true: colors.ink }}
              ios_backgroundColor={colors.line}
              accessibilityLabel="Chime when rest is over"
            />
          </View>
          <Text style={styles.hint}>The phone always buzzes when rest is over.</Text>
        </View>

        <Text style={styles.heading}>UNITS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Body weight</Text>
            <UnitToggle
              options={['lbs', 'kg'] as const}
              value={prefs.weightUnit}
              onChange={(weightUnit) => setPrefs({ weightUnit })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Body measurements</Text>
            <UnitToggle
              options={['in', 'cm'] as const}
              value={prefs.lengthUnit}
              onChange={(lengthUnit) => setPrefs({ lengthUnit })}
            />
          </View>
          <Text style={styles.hint}>Weights you lift are always logged in lbs, like the website.</Text>
        </View>

        <Text style={styles.heading}>DATA ON THIS PHONE</Text>
        <View style={styles.card}>
          <Text style={styles.body}>
            This version keeps everything on this phone only. It is not connected to
            flexdaddies.com, so nothing here changes the website, and workouts logged on the website
            do not show up here.
          </Text>
          <Text style={styles.hint}>
            {db.workouts.length} workouts · {db.weighIns.length} weigh-ins · {db.measurements.length}{' '}
            measurements · {db.templates.length} plans
          </Text>
          {hasSample && (
            <OutlineButton
              label="Remove sample data"
              onPress={() =>
                ask(
                  'Remove the sample data?',
                  'The made-up workouts, weigh-ins, measurements and notes are removed. Anything you logged yourself, your plans and your exercise list stay.',
                  'Remove',
                  removeSample,
                )
              }
            />
          )}
          <OutlineButton
            label="Start over with sample data"
            onPress={() =>
              ask(
                'Start over with sample data?',
                'Everything on this phone is replaced with the sample data, including anything you logged here.',
                'Start over',
                resetToSample,
              )
            }
          />
          <OutlineButton
            label="Erase everything on this phone"
            onPress={() =>
              ask(
                'Erase everything on this phone?',
                'All workouts, weigh-ins, measurements, notes, plans and exercise changes on this phone are deleted. The website is not affected.',
                'Erase',
                eraseEverything,
              )
            }
          />
        </View>

        <Text style={styles.version}>
          Flex Daddies {Constants.expoConfig?.version ?? ''} · preview build
        </Text>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 40, gap: 8 },
  heading: {
    fontFamily: fonts.headingBold,
    fontSize: 13,
    letterSpacing: 0.9,
    color: colors.muted,
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14 },
  hint: { fontSize: 14, color: colors.muted },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  version: { textAlign: 'center', color: colors.muted, fontSize: 13, marginTop: 18 },
});
