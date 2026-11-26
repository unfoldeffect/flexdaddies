// Settings: look, rest timer, units, the data kept on this phone, and the account.
import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useAuth } from '../data/auth';
import { forgetBackup, useBackupStatus } from '../data/backup';
import { shareTextFile } from '../data/files';
import { REST_CHOICES } from '../data/storage';
import { useStore } from '../data/store';
import { describeBackup } from '../lib/backup';
import { confirm } from '../lib/dialogs';
import { buzzSuccess, buzzWarning, tapLight } from '../lib/haptics';
import { exportCsv } from '../lib/transfer';
import { colors, fonts, themed } from '../theme';
import { ImportSheet } from './import-sheet';
import { PartnerLink } from './partner-link';
import { Sheet } from './sheet';
import { Chip, OutlineButton, UnitToggle } from './ui';

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { prefs, setPrefs, db, hasSample, removeSample, resetToSample, eraseEverything } =
    useStore();
  const { account, signOut, deleteAccount, saveProfile } = useAuth();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const saveName = async () => {
    if (!nameDraft?.trim()) return;
    setSavingName(true);
    setAccountProblem(null);
    const r = await saveProfile({ name: nameDraft.trim() });
    setSavingName(false);
    if (r.ok) {
      setNameDraft(null);
      buzzSuccess();
    } else setAccountProblem(r.message);
  };
  const backup = useBackupStatus();
  const [accountProblem, setAccountProblem] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const exportMine = async () => {
    const mine = db.workouts.filter((w) => w.user === 'me');
    if (!mine.length) {
      setExportNote('Nothing to export yet: log a workout first.');
      return;
    }
    try {
      const ok = await shareTextFile('flex-daddies-workouts.csv', exportCsv(mine));
      setExportNote(
        ok
          ? `${mine.length} ${mine.length === 1 ? 'workout' : 'workouts'} written to flex-daddies-workouts.csv, one row per set.`
          : "This phone can't share files.",
      );
    } catch {
      setExportNote("The file couldn't be made. Try again.");
    }
  };

  const askSignOut = async () => {
    buzzWarning();
    const yes = await confirm({
      title: 'Sign out?',
      message: 'Your workouts stay on this phone. Sign in again with the same email to carry on.',
      confirmLabel: 'Sign out',
    });
    if (yes) await signOut();
  };

  const askDeleteAccount = async () => {
    buzzWarning();
    const yes = await confirm({
      title: 'Delete your account?',
      message:
        'Your account and its backup are deleted for good, and every workout, weigh-in, measurement, note and routine on this phone is erased. This cannot be undone.',
      confirmLabel: 'Delete my account',
      destructive: true,
    });
    if (!yes) return;
    setAccountProblem(null);
    const r = await deleteAccount();
    if (!r.ok) {
      setAccountProblem(`${r.message} Your account was not deleted.`);
      return;
    }
    await forgetBackup();
    await eraseEverything();
    setPrefs({ partnerOn: false, partnerName: '' });
    buzzSuccess();
  };

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
        <Text style={styles.heading}>LOOK</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Dark or light</Text>
            <UnitToggle
              options={['Dark', 'Light'] as const}
              value={prefs.theme === 'light' ? 'Light' : 'Dark'}
              onChange={(look) => setPrefs({ theme: look === 'Light' ? 'light' : 'dark' })}
            />
          </View>
          <Text style={styles.hint}>Same layout either way. Switching closes Settings.</Text>
        </View>

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
              trackColor={{ false: colors.line, true: colors.gold }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.line}
              accessibilityLabel="Chime when rest is over"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Start rest when I check off a set</Text>
            <Switch
              value={prefs.restOnCheck}
              onValueChange={(restOnCheck) => {
                tapLight();
                setPrefs({ restOnCheck });
              }}
              trackColor={{ false: colors.line, true: colors.gold }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.line}
              accessibilityLabel="Start rest when I check off a set"
            />
          </View>
          <Text style={styles.hint}>The phone always buzzes when rest is over.</Text>
        </View>

        <Text style={styles.heading}>UNITS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Weights</Text>
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
          <Text style={styles.hint}>
            Used for the weights you lift and for your body weight.
          </Text>
        </View>

        <Text style={styles.heading}>LIFT WITH A PARTNER</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Log a partner&apos;s sets with mine</Text>
            <Switch
              value={prefs.partnerOn}
              onValueChange={(partnerOn) => {
                tapLight();
                setPrefs({ partnerOn });
              }}
              trackColor={{ false: colors.line, true: colors.gold }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.line}
              accessibilityLabel="Lift with a partner"
            />
          </View>
          {prefs.partnerOn && (
            <TextInput
              style={styles.input}
              value={prefs.partnerName}
              onChangeText={(partnerName) => setPrefs({ partnerName })}
              placeholder="Partner's first name"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="words"
              maxLength={40}
              returnKeyType="done"
              accessibilityLabel="Partner's first name"
            />
          )}
          <Text style={styles.hint}>
            {prefs.partnerOn
              ? 'A Together Mode switch is now on the Log screen. Turn it on to log both of you at once. Their workouts are saved on this phone.'
              : 'Off: the app is just for you. Turn it on if you train with someone and log for both.'}
          </Text>
          {prefs.partnerOn && <PartnerLink />}
        </View>

        <Text style={styles.heading}>DATA ON THIS PHONE</Text>
        <View style={styles.card}>
          <Text style={styles.body}>
            {backup.state === 'off'
              ? 'Your workouts are kept on this phone.'
              : `Your workouts are kept on this phone and backed up to your account. ${describeBackup(backup)}`}
          </Text>
          <Text style={styles.hint}>
            {db.workouts.length} workouts · {db.weighIns.length} weigh-ins ·{' '}
            {db.measurements.length} measurements · {db.templates.length} routines
          </Text>
          <OutlineButton label="Bring in workouts from Hevy or Strong" onPress={() => setImporting(true)} />
          <OutlineButton label="Export my workouts" onPress={exportMine} />
          {exportNote && <Text style={styles.hint}>{exportNote}</Text>}
          <OutlineButton
            label="Erase everything on this phone"
            onPress={() =>
              ask(
                'Erase everything on this phone?',
                'All workouts, weigh-ins, measurements, notes, routines and exercise changes on this phone are deleted.',
                'Erase',
                eraseEverything,
              )
            }
          />
        </View>

        <Text style={styles.heading}>TEST BUILD ONLY</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>
            For trying the app out. Customers will not see this card.
          </Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Pro unlocked (test switch)</Text>
            <Switch
              value={prefs.pro}
              onValueChange={(pro) => {
                tapLight();
                setPrefs({ pro });
              }}
              trackColor={{ false: colors.line, true: colors.gold }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.line}
              accessibilityLabel="Pro unlocked"
            />
          </View>
          {hasSample && (
            <OutlineButton
              label="Remove sample data"
              onPress={() =>
                ask(
                  'Remove the sample data?',
                  'The made-up workouts, weigh-ins, measurements and notes are removed. Anything you logged yourself, your routines and your exercise list stay.',
                  'Remove',
                  removeSample,
                )
              }
            />
          )}
          <OutlineButton
            label="Load sample data"
            onPress={() =>
              ask(
                'Load sample data?',
                'Everything on this phone is replaced with the sample data, including anything you logged here.',
                'Load',
                resetToSample,
              )
            }
          />
        </View>

        {account && (
          <>
            <Text style={styles.heading}>ACCOUNT</Text>
            <View style={styles.card}>
              <Text style={styles.body}>
                Signed in as {account.name ? `${account.name}, ` : ''}
                {account.email}
              </Text>
              <View style={styles.nameRow}>
                <TextInput
                  style={[styles.input, styles.nameInput]}
                  value={nameDraft ?? account.name}
                  onChangeText={setNameDraft}
                  placeholder="First name"
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="words"
                  maxLength={40}
                  returnKeyType="done"
                  accessibilityLabel="Your first name"
                />
                <OutlineButton
                  compact
                  label={savingName ? 'Saving...' : 'Save name'}
                  disabled={savingName || !nameDraft?.trim() || nameDraft.trim() === account.name}
                  onPress={saveName}
                />
              </View>
              <OutlineButton label="Sign out" onPress={askSignOut} />
              <OutlineButton label="Delete my account" onPress={askDeleteAccount} />
              {accountProblem && (
                <Text style={styles.problem} accessibilityRole="alert">
                  {accountProblem}
                </Text>
              )}
            </View>
          </>
        )}

        <Text style={styles.version}>
          Flex Daddies {Constants.expoConfig?.version ?? ''} · preview build
        </Text>
      </ScrollView>
      <ImportSheet visible={importing} onClose={() => setImporting(false)} />
    </Sheet>
  );
}

const styles = themed(() => StyleSheet.create({
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14 },
  hint: { fontSize: 14, color: colors.muted },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: { flex: 1 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.field,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
  },
  problem: { fontSize: 15, fontWeight: '600', color: colors.danger },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  version: { textAlign: 'center', color: colors.muted, fontSize: 13, marginTop: 18 },
}));
