// Stats tab: one exercise over time (free for the last 3 months), and the Pro
// charts: estimated one-rep max, sets by body part, and consistency.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useStore } from '../data/store';
import { notify } from '../lib/dialogs';
import {
  FREE_RANGE,
  RANGES,
  RANGE_WORDS,
  consistency,
  exerciseProgress,
  inRange,
  setsByBodyPart,
  trackedExercises,
  type Range,
} from '../lib/progress';
import { PRO_CHARTS_TITLE, PRO_MAX_MESSAGE, PRO_RANGE_MESSAGE } from '../lib/pro';
import { OTHER_CATEGORY } from '../lib/workout-data';
import { colors, fonts, themed } from '../theme';
import { LineChart, describeTrend } from './line-chart';
import { Sheet } from './sheet';
import { Chip, EmptyState, Icon } from './ui';

type Metric = 'top' | 'max';

export function ExerciseProgress() {
  const { db, prefs } = useStore();
  const pro = prefs.pro;
  const exercises = useMemo(() => trackedExercises(db.workouts, 'me'), [db.workouts]);
  const [picked, setPicked] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [metric, setMetric] = useState<Metric>('top');
  const [range, setRange] = useState<Range>(FREE_RANGE);

  // Falls back to the most-logged exercise, and to the free view when Pro is off.
  const current = exercises.find((e) => e.key === picked) ?? exercises[0];
  const shownRange = pro ? range : FREE_RANGE;
  const shownMetric: Metric = pro ? metric : 'top';
  const points = useMemo(
    () => (current ? inRange(exerciseProgress(db.workouts, 'me', current.key), shownRange) : []),
    [db.workouts, current, shownRange],
  );
  if (!current) return null;

  const values = points
    .map((p) => (shownMetric === 'max' ? p.oneRepMax : p.topWeight))
    .filter((v): v is number => v !== null);
  const first = values[0];
  const last = values[values.length - 1];
  const change = values.length >= 2 ? last - first : 0;
  const what = shownMetric === 'max' ? 'Estimated one-rep max' : 'Top weight';

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Progress for ${current.label}. Tap to change.`}
        onPress={() => setChoosing(true)}
        style={({ pressed }) => [styles.select, pressed && styles.pressed]}
      >
        <Text style={styles.selectText} numberOfLines={2}>
          {current.label}
        </Text>
        <Icon name="chevron-down" color={colors.muted} />
      </Pressable>

      <View style={styles.chips}>
        <Chip label="Top weight" active={shownMetric === 'top'} onPress={() => setMetric('top')} />
        <Chip
          label={pro ? 'Est. 1-rep max' : 'Est. 1-rep max (Pro)'}
          active={shownMetric === 'max'}
          onPress={() => (pro ? setMetric('max') : void notify(PRO_CHARTS_TITLE, PRO_MAX_MESSAGE))}
        />
      </View>

      {values.length >= 2 ? (
        <>
          <LineChart
            height={96}
            label={`${what} on ${current.label} over ${RANGE_WORDS[shownRange]}, ${describeTrend(values, 'lbs')}`}
            series={[{ values, color: colors.gold }]}
          />
          <Text style={styles.summary}>
            {what}: {first} to {last} lbs{' '}
            <Text style={change >= 0 ? styles.up : styles.down}>
              ({change >= 0 ? '+' : ''}
              {change})
            </Text>{' '}
            over {RANGE_WORDS[shownRange]}
          </Text>
        </>
      ) : (
        <EmptyState compact sub={`Log this exercise twice in ${RANGE_WORDS[shownRange]} to see a line.`} />
      )}

      <View style={styles.chips} accessibilityLabel="Time range">
        {RANGES.map((r) => (
          <Chip
            key={r}
            label={r}
            active={shownRange === r}
            onPress={() => (pro ? setRange(r) : r !== FREE_RANGE && void notify(PRO_CHARTS_TITLE, PRO_RANGE_MESSAGE))}
            style={styles.rangeChip}
          />
        ))}
      </View>
      {!pro && <Text style={styles.hint}>Free shows the last 3 months. Pro shows your whole history.</Text>}

      <Sheet visible={choosing} title="Choose an exercise" onClose={() => setChoosing(false)}>
        <ScrollView contentContainerStyle={styles.list}>
          {exercises.map((e) => (
            <Pressable
              key={e.key}
              accessibilityRole="button"
              accessibilityLabel={`${e.label}, logged ${e.sessions} times`}
              accessibilityState={{ selected: e.key === current.key }}
              onPress={() => {
                setPicked(e.key);
                setChoosing(false);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={[styles.rowText, e.key === current.key && styles.rowTextOn]}>{e.label}</Text>
              <Text style={styles.rowCount}>
                {e.sessions} {e.sessions === 1 ? 'time' : 'times'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

/** The Pro charts, or one card saying what Pro adds. */
export function ProCharts() {
  const { db, prefs, toCategory } = useStore();
  const parts = useMemo(
    () => setsByBodyPart(db.workouts, 'me', (name) => toCategory[name] ?? OTHER_CATEGORY),
    [db.workouts, toCategory],
  );
  const steady = useMemo(() => consistency(db.workouts, 'me'), [db.workouts]);

  if (!prefs.pro) {
    return (
      <View style={[styles.card, styles.locked]}>
        <View style={styles.lockedHead}>
          <Icon name="lock-outline" size={20} color={colors.goldDeep} />
          <Text style={styles.cardTitle}>MORE WITH PRO</Text>
        </View>
        <Text style={styles.lockedText}>
          Your whole history on every exercise, estimated one-rep max, sets by body part each week,
          and your streak.
        </Text>
      </View>
    );
  }

  const most = Math.max(1, ...parts.map((p) => Math.max(p.thisWeek, p.usual)));
  const busiest = Math.max(1, ...steady.weeks);
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>SETS BY BODY PART</Text>
        <Text style={styles.hint}>The last 7 days. The thin line is your usual week.</Text>
        {parts.length === 0 ? (
          <EmptyState compact sub="Nothing logged in the last 5 weeks." />
        ) : (
          parts.map((p) => (
            <View
              key={p.label}
              style={styles.part}
              accessible
              accessibilityLabel={`${p.label}: ${p.thisWeek} sets this week, usually ${p.usual}`}
            >
              <View style={styles.partHead}>
                <Text style={styles.partLabel}>{p.label}</Text>
                <Text style={styles.partNumber}>
                  {p.thisWeek} <Text style={styles.partUsual}>· usual {p.usual}</Text>
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${(p.thisWeek / most) * 100}%`, backgroundColor: p.color }]} />
                <View style={[styles.usualMark, { left: `${Math.min(99, (p.usual / most) * 100)}%` }]} />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>CONSISTENCY</Text>
        <View style={styles.steadyRow}>
          <View style={styles.steadyBox}>
            <Text style={styles.steadyNumber}>{steady.streak}</Text>
            <Text style={styles.steadyLabel}>{steady.streak === 1 ? 'week in a row' : 'weeks in a row'}</Text>
          </View>
          <View style={styles.steadyBox}>
            <Text style={styles.steadyNumber}>{steady.perWeek}</Text>
            <Text style={styles.steadyLabel}>workouts a week</Text>
          </View>
        </View>
        <View
          style={styles.weeks}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Workouts in each of the last 12 weeks, oldest first: ${steady.weeks.join(', ')}`}
        >
          {steady.weeks.map((count, i) => (
            <View key={i} style={styles.weekSlot}>
              <View
                style={[
                  styles.weekBar,
                  { height: `${Math.max(6, (count / busiest) * 100)}%` },
                  count === 0 && styles.weekBarEmpty,
                ]}
              />
            </View>
          ))}
        </View>
        <Text style={styles.hint}>Last 12 weeks, oldest on the left.</Text>
      </View>
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 14, letterSpacing: 0.6, color: colors.muted },
  select: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.field,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectText: { flex: 1, fontSize: 18, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeChip: { minWidth: 56, alignItems: 'center' },
  summary: { fontSize: 16, color: colors.text, lineHeight: 22 },
  up: { color: colors.down, fontWeight: '700' },
  down: { color: colors.up, fontWeight: '700' },
  hint: { fontSize: 14, color: colors.muted },
  list: { paddingHorizontal: 18, paddingBottom: 40 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowText: { flex: 1, fontSize: 18, color: colors.text },
  rowTextOn: { fontWeight: '700' },
  rowCount: { fontSize: 15, color: colors.muted },
  locked: { borderStyle: 'dashed', borderColor: colors.gold },
  lockedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedText: { fontSize: 16, lineHeight: 23, color: colors.text },
  part: { gap: 4 },
  partHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  partLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  partNumber: { fontSize: 16, fontWeight: '700', color: colors.text },
  partUsual: { fontSize: 14, fontWeight: '400', color: colors.muted },
  track: { height: 14, borderRadius: 7, backgroundColor: colors.field, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 7 },
  usualMark: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: colors.text },
  steadyRow: { flexDirection: 'row', gap: 12 },
  steadyBox: { flex: 1, borderRadius: 14, backgroundColor: colors.field, padding: 12, alignItems: 'center' },
  steadyNumber: { fontFamily: fonts.headingBold, fontSize: 30, color: colors.text },
  steadyLabel: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  weeks: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 64 },
  weekSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  weekBar: { borderRadius: 4, backgroundColor: colors.gold },
  weekBarEmpty: { backgroundColor: colors.line },
}));
