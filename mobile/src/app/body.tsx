// BODY tab: body weight and the six body measurements, with trends.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { DateField } from '@/components/date-field';
import { KeyboardScroll } from '@/components/keyboard-scroll';
import { LineChart, describeTrend } from '@/components/line-chart';
import { NumberField } from '@/components/number-field';
import { TogetherToggle } from '@/components/together-toggle';
import {
  Dot,
  DotCard,
  ErrorBanner,
  FieldLabel,
  Icon,
  IconButton,
  Plate,
  PrimaryButton,
  SectionHeading,
  UnitToggle,
} from '@/components/ui';
import { useStore } from '@/data/store';
import { confirm } from '@/lib/dialogs';
import { buzzSuccess, buzzWarning, tapLight } from '@/lib/haptics';
import {
  fmt1,
  inchesTo,
  lbsTo,
  lostLabel,
  measurementTotals,
  measurementsByPersonPart,
  signed,
  toStoredInches,
  toStoredLbs,
  weighInsByUser,
  weightSummary,
} from '@/lib/stats';
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from '@/lib/types';
import { USERS, USER_COLORS, formatDate, todayISO, uid, type WorkoutUser } from '@/lib/workout-data';
import { sanitizeWeightInput } from '@/lib/workout-helpers';
import { colors, fonts } from '@/theme';

// On the navy weight card: the logged-in person in gold, their partner in white.
const CARD_LINE = { me: colors.gold, other: colors.white };

export default function BodyScreen() {
  const store = useStore();
  const { user, otherUser, togetherMode, db, prefs } = store;
  const wUnit = prefs.weightUnit;
  const lUnit = prefs.lengthUnit;

  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [expandedUser, setExpandedUser] = useState<WorkoutUser | null>(null);

  const [part, setPart] = useState<BodyPart>('waist');
  const [mDate, setMDate] = useState(todayISO());
  const [mValue, setMValue] = useState('');
  const [savingMeasure, setSavingMeasure] = useState(false);
  const [mHistoryOpen, setMHistoryOpen] = useState(false);

  const byUser = useMemo(() => weighInsByUser(db.weighIns), [db.weighIns]);
  const byPersonPart = useMemo(() => measurementsByPersonPart(db.measurements), [db.measurements]);

  if (!user || !otherUser) return null;

  // Who is shown: just me, or both of us in Together Mode (me first).
  const people: WorkoutUser[] = togetherMode ? [user, otherUser] : [user];
  const toW = (lbs: number) => lbsTo(wUnit, lbs);
  const toL = (inches: number) => inchesTo(lUnit, inches);

  const saveWeight = async () => {
    const num = Number(weight);
    if (!weight || Number.isNaN(num) || num <= 0) return;
    setSavingWeight(true);
    const ok = await store.addWeighIn({
      id: uid(),
      user,
      date,
      weight: toStoredLbs(num, wUnit),
      loggedAt: new Date().toISOString(),
    });
    setSavingWeight(false);
    if (ok) {
      buzzSuccess();
      setWeight('');
      setDate(todayISO());
    }
  };

  const saveMeasurement = async () => {
    const num = Number(mValue);
    if (!mValue || Number.isNaN(num) || num <= 0) return;
    setSavingMeasure(true);
    const ok = await store.addMeasurement({
      id: uid(),
      user,
      date: mDate,
      part,
      valueIn: toStoredInches(num, lUnit),
      loggedAt: new Date().toISOString(),
    });
    setSavingMeasure(false);
    if (ok) {
      buzzSuccess();
      setMValue('');
    }
  };

  const confirmDelete = async (what: string, action: () => Promise<boolean>) => {
    buzzWarning();
    if (await confirm({ title: `Delete ${what}?`, confirmLabel: 'Delete', destructive: true })) {
      void action();
    }
  };

  const partHistory = people
    .flatMap((u) => byPersonPart[u][part])
    .sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt));
  const partHasTrend = people.some((u) => byPersonPart[u][part].length >= 2);
  const partLabel = BODY_PART_LABELS[part];

  return (
    <View style={styles.root}>
      <AppHeader />
      <KeyboardScroll bottomSpace={190}>
        {store.error && <ErrorBanner message={store.error} onDismiss={store.clearError} />}

        <TogetherToggle
          on={togetherMode}
          onChange={store.setTogetherMode}
          user={user}
          otherUser={otherUser}
        />

        {/* ---------- WEIGHT ---------- */}
        <DotCard style={styles.weightCard}>
          <View style={togetherMode ? styles.pair : undefined}>
            {people.map((u) => {
              const st = weightSummary(byUser[u]);
              const lineColor = u === user ? CARD_LINE.me : CARD_LINE.other;
              return (
                <View key={u} style={[styles.weightTop, togetherMode && styles.weightTopPair]}>
                  <View>
                    <View style={styles.weightLabelRow}>
                      {togetherMode && <Dot color={lineColor} size={9} />}
                      <Text style={styles.weightLabel}>{togetherMode ? u.toUpperCase() : 'WEIGHT'}</Text>
                    </View>
                    <Text style={[styles.weightNumber, togetherMode && { fontSize: 32 }]}>
                      {st.latest ? fmt1(toW(st.latest.weight)) : '—'}
                      {st.latest && <Text style={styles.weightUnit}> {wUnit}</Text>}
                    </Text>
                    <Text style={styles.weightMeta}>
                      {st.latest ? formatDate(st.latest.date) : 'No weigh-ins yet'}
                    </Text>
                  </View>
                  <View style={[styles.deltas, togetherMode && { alignItems: 'flex-start' }]}>
                    {st.delta !== null && (
                      <DeltaPill value={toW(st.delta)} label="since last" onDark />
                    )}
                    {st.total !== null && <DeltaPill value={toW(st.total)} label="total" onDark />}
                  </View>
                </View>
              );
            })}
          </View>
          {people.some((u) => byUser[u].length >= 2) && (
            <View style={styles.weightChart}>
              <LineChart
                height={56}
                label={`Weight trend. ${people
                  .map(
                    (u) =>
                      `${u}: ${describeTrend(weightSummary(byUser[u]).series.map(toW), wUnit)}`,
                  )
                  .join('. ')}`}
                series={people.map((u) => ({
                  values: weightSummary(byUser[u]).series.map(toW),
                  color: u === user ? CARD_LINE.me : CARD_LINE.other,
                }))}
              />
            </View>
          )}
        </DotCard>

        <View style={styles.quickLog}>
          <View style={styles.quickField}>
            <FieldLabel>DATE</FieldLabel>
            <DateField value={date} onChange={setDate} label="Weigh-in date" />
          </View>
          <View style={styles.quickField}>
            <FieldLabel>{togetherMode ? `${user.toUpperCase()}'S WEIGHT` : 'WEIGHT'}</FieldLabel>
            <View style={styles.quickValue}>
              <NumberField
                decimal
                big
                style={styles.quickInput}
                placeholder="0.0"
                value={weight}
                accessibilityLabel={`Weight in ${wUnit}`}
                onChangeText={(v) => setWeight(sanitizeWeightInput(v, weight))}
                onSubmitEditing={saveWeight}
              />
              <UnitToggle
                vertical
                options={['lbs', 'kg'] as const}
                value={wUnit}
                onChange={(weightUnit) => store.setPrefs({ weightUnit })}
              />
            </View>
          </View>
        </View>
        <PrimaryButton
          compact
          label={savingWeight ? 'SAVING...' : 'LOG WEIGHT'}
          disabled={!weight || savingWeight}
          onPress={saveWeight}
          style={styles.logBtn}
        />

        {USERS.map((u) => {
          const list = byUser[u];
          const open = expandedUser === u;
          return (
            <View style={styles.accordion} key={u}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${u}'s weigh-ins, ${list.length}`}
                onPress={() => {
                  tapLight();
                  setExpandedUser(open ? null : u);
                }}
                style={({ pressed }) => [styles.accordionHead, pressed && { opacity: 0.75 }]}>
                <Plate size={28} label={u[0]} color={USER_COLORS[u]} />
                <Text style={styles.accordionTitle}>{u}&apos;s Weigh-Ins</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{list.length}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <Icon name={open ? 'chevron-up' : 'chevron-down'} color={colors.muted} />
              </Pressable>
              {open && (
                <View style={styles.accordionBody}>
                  {list.length === 0 ? (
                    <Text style={styles.emptySub}>No weigh-ins logged yet.</Text>
                  ) : (
                    list.map((w) => (
                      <View style={styles.entryRow} key={w.id}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.entryValue}>
                            {fmt1(toW(w.weight))} {wUnit}
                          </Text>
                          <Text style={styles.entryMeta}>{formatDate(w.date)}</Text>
                        </View>
                        {w.user === user && (
                          <IconButton
                            icon="trash-can-outline"
                            label={`Delete weigh-in from ${formatDate(w.date)}`}
                            size={40}
                            color={colors.danger}
                            style={styles.plainIconBtn}
                            onPress={() =>
                              confirmDelete('this weigh-in', () => store.removeWeighIn(w.id))
                            }
                          />
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* ---------- BODY MEASUREMENTS ---------- */}
        <View style={styles.measureHeading}>
          <SectionHeading style={styles.measureTitle}>Body Measurements</SectionHeading>
          <UnitToggle
            options={['in', 'cm'] as const}
            value={lUnit}
            onChange={(lengthUnit) => store.setPrefs({ lengthUnit })}
          />
        </View>

        <View style={styles.summaryRow}>
          {(['sinceStart', 'sinceLast'] as const).map((key) => (
            <View style={styles.summaryItem} key={key}>
              {people.map((u) => {
                const t = measurementTotals(byPersonPart[u]);
                return (
                  <Text style={styles.summaryNumber} key={u}>
                    {togetherMode && (
                      <Text style={[styles.who, { color: u === user ? colors.gold : colors.white }]}>
                        {u[0]}{' '}
                      </Text>
                    )}
                    {t ? lostLabel(t[key], lUnit) : '—'}
                  </Text>
                );
              })}
              <Text style={styles.summaryLabel}>
                {key === 'sinceStart' ? 'TOTAL SINCE START' : 'SINCE LAST CHECK-IN'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {BODY_PARTS.map((p) => {
            const on = part === p;
            return (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${BODY_PART_LABELS[p]}. ${people
                  .map((u) => {
                    const last = byPersonPart[u][p][0];
                    return `${u}: ${last ? `${fmt1(toL(last.valueIn))} ${lUnit}` : 'nothing logged'}`;
                  })
                  .join('. ')}`}
                onPress={() => {
                  tapLight();
                  setPart(p);
                  setMValue('');
                  setMHistoryOpen(false);
                }}
                style={[styles.tile, on && styles.tileOn]}>
                <Text style={styles.tileLabel}>{BODY_PART_LABELS[p]}</Text>
                {people.map((u) => {
                  const list = byPersonPart[u][p];
                  const last = list[0];
                  const prev = list[1];
                  const d = last && prev ? toL(last.valueIn - prev.valueIn) : null;
                  return (
                    <View key={u} style={styles.tilePerson}>
                      <Text style={[styles.tileNumber, togetherMode && { fontSize: 18 }]}>
                        {togetherMode && (
                          <Text style={[styles.who, { color: USER_COLORS[u] }]}>{u[0]} </Text>
                        )}
                        {last ? fmt1(toL(last.valueIn)) : '—'}
                        {last && <Text style={styles.tileUnit}> {lUnit}</Text>}
                      </Text>
                      {d !== null && <DeltaPill value={d} small />}
                    </View>
                  );
                })}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{partLabel}</Text>
          {partHasTrend ? (
            <View style={{ marginBottom: 12 }}>
              <LineChart
                height={70}
                label={`${partLabel} trend. ${people
                  .map(
                    (u) =>
                      `${u}: ${describeTrend(
                        [...byPersonPart[u][part]].reverse().map((m) => toL(m.valueIn)),
                        lUnit,
                      )}`,
                  )
                  .join('. ')}`}
                series={people.map((u) => ({
                  values: [...byPersonPart[u][part]].reverse().map((m) => toL(m.valueIn)),
                  color: USER_COLORS[u],
                }))}
              />
            </View>
          ) : (
            <Text style={[styles.emptySub, { marginBottom: 12 }]}>
              {partHistory.length === 0
                ? 'No measurements yet. Log your first one below.'
                : 'Log another one to see the trend.'}
            </Text>
          )}

          <View style={styles.quickLog}>
            <View style={styles.quickField}>
              <FieldLabel>DATE</FieldLabel>
              <DateField value={mDate} onChange={setMDate} label="Measurement date" onWhite />
            </View>
            <View style={styles.quickField}>
              <FieldLabel>
                {togetherMode
                  ? `${user.toUpperCase()}'S ${partLabel.toUpperCase()}`
                  : partLabel.toUpperCase()}
              </FieldLabel>
              <View style={styles.quickValue}>
                <NumberField
                  decimal
                  big
                  style={styles.quickInput}
                  placeholder="0.0"
                  value={mValue}
                  accessibilityLabel={`${partLabel} in ${lUnit}`}
                  onChangeText={(v) => setMValue(sanitizeWeightInput(v, mValue))}
                  onSubmitEditing={saveMeasurement}
                />
                <UnitToggle
                  vertical
                  options={['in', 'cm'] as const}
                  value={lUnit}
                  onChange={(lengthUnit) => store.setPrefs({ lengthUnit })}
                />
              </View>
            </View>
          </View>
          <PrimaryButton
            compact
            label={savingMeasure ? 'SAVING...' : `LOG ${partLabel.toUpperCase()}`}
            disabled={!mValue || savingMeasure}
            onPress={saveMeasurement}
          />

          {partHistory.length > 0 && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: mHistoryOpen }}
                onPress={() => {
                  tapLight();
                  setMHistoryOpen(!mHistoryOpen);
                }}
                style={({ pressed }) => [styles.historyToggle, pressed && { opacity: 0.7 }]}>
                <Text style={styles.historyToggleText}>
                  {partLabel} history ({partHistory.length})
                </Text>
                <Icon name={mHistoryOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Pressable>
              {mHistoryOpen && (
                <View style={styles.historyList}>
                  {partHistory.map((m) => (
                    <View style={styles.entryRow} key={m.id}>
                      {togetherMode && (
                        <Plate size={26} label={m.user[0]} color={USER_COLORS[m.user]} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryValue}>
                          {fmt1(toL(m.valueIn))} {lUnit}
                        </Text>
                        <Text style={styles.entryMeta}>{formatDate(m.date)}</Text>
                      </View>
                      {m.user === user && (
                        <IconButton
                          icon="trash-can-outline"
                          label={`Delete ${partLabel} measurement from ${formatDate(m.date)}`}
                          size={40}
                          color={colors.danger}
                          style={styles.plainIconBtn}
                          onPress={() =>
                            confirmDelete('this measurement', () => store.removeMeasurement(m.id))
                          }
                        />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </KeyboardScroll>
    </View>
  );
}

/** "-1.2 since last": green when going down, red when going up. */
function DeltaPill({
  value,
  label,
  onDark,
  small,
}: {
  value: number;
  label?: string;
  onDark?: boolean;
  small?: boolean;
}) {
  const down = value <= 0;
  const fg = onDark ? (down ? colors.downOnDark : colors.upOnDark) : down ? colors.down : colors.up;
  const bg = onDark
    ? 'rgba(255,255,255,0.1)'
    : down
      ? 'rgba(22,163,74,0.12)'
      : 'rgba(220,38,38,0.1)';
  return (
    <View style={[styles.delta, { backgroundColor: bg }, small && styles.deltaSmall]}>
      <Text style={[styles.deltaText, { color: fg }, small && { fontSize: 13 }]}>
        {signed(value)}
        {label ? ` ${label}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  weightCard: { padding: 18, marginBottom: 14 },
  pair: { flexDirection: 'row', gap: 14 },
  weightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  weightTopPair: { flex: 1, flexDirection: 'column', gap: 6 },
  weightLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightLabel: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 1.2, color: colors.white },
  weightNumber: { fontFamily: fonts.headingBold, fontSize: 42, color: colors.gold },
  weightUnit: { fontSize: 18, fontFamily: fonts.heading, color: colors.gold },
  weightMeta: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
  deltas: { alignItems: 'flex-end', gap: 6 },
  weightChart: { marginTop: 10 },
  delta: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  deltaSmall: { paddingHorizontal: 8, paddingVertical: 1, alignSelf: 'center', marginTop: 2 },
  deltaText: { fontSize: 14, fontWeight: '700' },
  quickLog: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickField: { flex: 1, gap: 6 },
  quickValue: { flexDirection: 'row', gap: 6, alignItems: 'stretch' },
  quickInput: { flex: 1, minWidth: 0 },
  logBtn: { marginBottom: 14 },
  accordion: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 10,
  },
  accordionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 14 },
  accordionTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  countBadge: { backgroundColor: colors.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  countText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  accordionBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  emptySub: { fontSize: 15, color: colors.muted },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 56,
  },
  entryValue: { fontFamily: fonts.headingBold, fontSize: 17, color: colors.text },
  entryMeta: { fontSize: 14, color: colors.muted },
  plainIconBtn: { borderWidth: 0, backgroundColor: 'transparent' },
  measureHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  measureTitle: { fontSize: 21, marginBottom: 0 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryItem: { flex: 1, backgroundColor: colors.ink, borderRadius: 16, padding: 12, alignItems: 'center' },
  summaryNumber: { fontFamily: fonts.headingBold, fontSize: 19, color: colors.gold, textAlign: 'center' },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: colors.white,
    marginTop: 2,
    textAlign: 'center',
  },
  who: { fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tile: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 92,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tileOn: { borderColor: colors.gold, borderWidth: 3, backgroundColor: '#fbf6e3' },
  tileLabel: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 0.4, color: colors.muted },
  tilePerson: { alignItems: 'center' },
  tileNumber: { fontFamily: fonts.headingBold, fontSize: 23, color: colors.ink },
  tileUnit: { fontSize: 13, color: colors.muted, fontFamily: fonts.heading },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 14,
  },
  panelTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.text, marginBottom: 8 },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    marginTop: 4,
  },
  historyToggleText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  historyList: { gap: 8 },
});
