// STATS tab: totals, progress charts and personal records.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { LineChart, describeTrend } from '@/components/line-chart';
import { ExerciseProgress, ProCharts } from '@/components/progress-charts';
import { weeklyVolume } from '@/lib/progress';
import { Dot, DotCard, EmptyState, Icon, Plate, SectionHeading } from '@/components/ui';
import { useStore } from '@/data/store';
import { tapLight } from '@/lib/haptics';
import { computeWorkoutStats, weighInsByUser, weightLoss, lbsTo, liftShown, totalShown } from '@/lib/stats';
import { possessive } from '@/lib/words';
import {
  OTHER_CATEGORY,
  USER_COLORS,
  formatDate,
  type WorkoutUser,
} from '@/lib/workout-data';
import { colors, fonts, hexToRgba, themed } from '@/theme';

export default function StatsScreen() {
  const { db, toCategory, people, names, prefs } = useStore();
  const unit = prefs.weightUnit;
  const [expandedUser, setExpandedUser] = useState<WorkoutUser | null>('me');

  const stats = useMemo(() => computeWorkoutStats(db.workouts), [db.workouts]);
  const weighIns = useMemo(() => weighInsByUser(db.weighIns), [db.weighIns]);
  const weeks = useMemo(() => weeklyVolume(db.workouts, people), [db.workouts, people]);

  if (!db.workouts.length) {
    return (
      <View style={styles.root}>
        <AppHeader />
        <EmptyState
          plateLabel="0"
          title="No data yet."
          sub="Stats show up once you start logging."
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DotCard style={styles.hero}>
          <Text style={styles.heroNumber}>{stats.total}</Text>
          <Text style={styles.heroLabel}>TOTAL WORKOUTS LOGGED</Text>
        </DotCard>

        <View style={styles.tiles}>
          <View style={[styles.tile, { backgroundColor: hexToRgba(colors.gold, 0.5) }]}>
            <Text style={styles.tileNumber}>{stats.thisWeek}</Text>
            <Text style={styles.tileLabel}>Last 7 Days</Text>
          </View>
          {people.map((u) => (
            <View
              key={u}
              style={[styles.tile, { backgroundColor: hexToRgba(USER_COLORS[u], 0.12) }]}
            >
              <Text style={[styles.tileNumber, { color: USER_COLORS[u] }]}>
                {stats.perUser[u].count}
              </Text>
              <Text style={[styles.tileLabel, { color: USER_COLORS[u] }]}>{possessive(names[u])} Sessions</Text>
            </View>
          ))}
        </View>

        <SectionHeading>Progress</SectionHeading>
        {weeks.some((v) => v > 0) ? (
          <View style={styles.chartCard}>
            <Text style={styles.chartLabel}>WEIGHT LIFTED, LAST 8 WEEKS</Text>
            <View
              style={styles.bars}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Weight lifted in each of the last 8 weeks, oldest first, in ${unit}: ${weeks.map((v) => totalShown(v, unit)).join(', ')}`}
            >
              {weeks.map((v, i) => (
                <View key={i} style={styles.barSlot}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${Math.max(4, (v / Math.max(1, ...weeks)) * 100)}%` },
                      i === weeks.length - 1 && { backgroundColor: colors.gold },
                      v === 0 && { backgroundColor: colors.line },
                    ]}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.barsNote}>
              This week: {totalShown(weeks[weeks.length - 1], unit).toLocaleString()} {unit}
            </Text>
          </View>
        ) : (
          <EmptyState compact sub="Log a workout with weights to see your weeks." />
        )}

        {people.map((u) => {
          const list = weighIns[u];
          if (!list.length) return null;
          const loss = weightLoss(list);
          const series = [...list].reverse().map((w) => w.weight);
          return (
            <View style={styles.chartCard} key={u}>
              <View style={styles.chartHead}>
                <View style={styles.chartHeadLeft}>
                  <Dot color={USER_COLORS[u]} />
                  <Text style={styles.chartLabel}>{possessive(names[u]).toUpperCase()} WEIGHT LOSS</Text>
                </View>
                {loss !== null && (
                  <View
                    style={[
                      styles.lossPill,
                      {
                        backgroundColor: loss >= 0 ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
                      },
                    ]}
                  >
                    <Text style={[styles.lossText, { color: loss >= 0 ? colors.down : colors.up }]}>
                      {loss > 0 ? '−' : loss < 0 ? '+' : ''}
                      {Math.abs(lbsTo(unit, loss)).toFixed(1)} {unit} {loss >= 0 ? 'lost' : 'gained'}
                    </Text>
                  </View>
                )}
              </View>
              {series.length >= 2 ? (
                <LineChart
                  height={70}
                  label={`${possessive(names[u])} weight, ${describeTrend(series.map((v) => lbsTo(unit, v)), unit)}`}
                  series={[{ values: series, color: USER_COLORS[u] }]}
                />
              ) : (
                <Text style={styles.emptySub}>Log another weigh-in to see the trend.</Text>
              )}
            </View>
          );
        })}

        <SectionHeading style={{ marginTop: 8 }}>Exercise Progress</SectionHeading>
        <ExerciseProgress />
        <ProCharts />

        <SectionHeading style={{ marginTop: 8 }}>Personal Records</SectionHeading>
        {people.map((u) => {
          const list = stats.prs[u];
          const open = expandedUser === u;
          return (
            <View style={styles.accordion} key={u}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${possessive(names[u])} personal records, ${list.length}`}
                onPress={() => {
                  tapLight();
                  setExpandedUser(open ? null : u);
                }}
                style={({ pressed }) => [styles.accordionHead, pressed && { opacity: 0.75 }]}
              >
                <Plate size={32} label={names[u][0]} color={USER_COLORS[u]} />
                <Text style={styles.accordionTitle} numberOfLines={2}>
                  {possessive(names[u])} Personal Records
                </Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{list.length}</Text>
                </View>
                <Icon name={open ? 'chevron-up' : 'chevron-down'} color={colors.muted} />
              </Pressable>
              {open && (
                <View style={styles.prList}>
                  {list.length === 0 ? (
                    <Text style={styles.emptySub}>No records yet.</Text>
                  ) : (
                    list.map((pr) => {
                      const cat = toCategory[pr.movement] || OTHER_CATEGORY;
                      return (
                        <View style={styles.prRow} key={pr.name}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.prName}>{pr.name}</Text>
                            <View style={styles.prMeta}>
                              <Dot color={cat.color} />
                              <Text style={styles.prDate}>{formatDate(pr.date)}</Text>
                            </View>
                          </View>
                          <Text style={styles.prWeight}>
                            {liftShown(pr.weight, unit)}
                            <Text style={styles.prUnit}> {unit}</Text>
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 190,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  hero: { paddingVertical: 30, paddingHorizontal: 24, alignItems: 'center', marginBottom: 14 },
  heroNumber: { fontFamily: fonts.headingBold, fontSize: 52, color: colors.gold },
  heroLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.white,
    marginTop: 2,
  },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  tile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tileNumber: { fontFamily: fonts.headingBold, fontSize: 26, color: colors.text },
  tileLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
    textAlign: 'center',
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 6, backgroundColor: colors.blue },
  barsNote: { fontSize: 15, fontWeight: '600', color: colors.text },
  chartCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chartHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  chartLabel: { fontFamily: fonts.heading, fontSize: 14, letterSpacing: 0.6, color: colors.muted },
  lossPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  lossText: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 15, color: colors.muted },
  accordion: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  accordionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
  },
  accordionTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  countBadge: {
    backgroundColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  prList: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  prName: { fontSize: 16, fontWeight: '600', color: colors.text },
  prMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  prDate: { fontSize: 14, color: colors.muted },
  prWeight: { fontSize: 19, fontWeight: '700', color: colors.text },
  prUnit: { fontSize: 13, fontWeight: '400', color: colors.muted },
}));
