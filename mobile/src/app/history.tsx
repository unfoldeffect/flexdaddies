// HISTORY tab: every logged workout, newest first. Tap one to open it.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { EditWorkoutSheet } from '@/components/edit-workout-sheet';
import { PromptSheet } from '@/components/prompt-sheet';
import { Chip, Dot, EmptyState, ErrorBanner, Icon, LinkButton, Plate } from '@/components/ui';
import { useLogDraftActions } from '@/data/log-draft';
import { useStore } from '@/data/store';
import { confirm } from '@/lib/dialogs';
import { blankDraftSets, workoutExercisesToDraft } from '@/lib/draft';
import { buzzSuccess, buzzWarning, tapLight } from '@/lib/haptics';
import { sortWorkoutsNewestFirst, workoutTotals } from '@/lib/stats';
import type { Workout } from '@/lib/types';
import {
  CARDIO_LABEL,
  OTHER_CATEGORY,
  USERS,
  USER_COLORS,
  formatDate,
  type WorkoutUser,
} from '@/lib/workout-data';
import { colors, fonts } from '@/theme';

type Filter = 'all' | WorkoutUser;

export default function HistoryScreen() {
  const store = useStore();
  const draftActions = useLogDraftActions();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Workout | null>(null);
  const [namingPlanFor, setNamingPlanFor] = useState<Workout | null>(null);

  const { user, db, toCategory } = store;
  const sorted = useMemo(() => sortWorkoutsNewestFirst(db.workouts), [db.workouts]);
  const filtered = filter === 'all' ? sorted : sorted.filter((w) => w.user === filter);
  if (!user) return null;

  const repeat = async (workout: Workout) => {
    if (
      draftActions.hasEntries() &&
      !(await confirm({
        title: 'Replace your unsaved workout?',
        message: 'You have an unsaved workout. Replace it with this one?',
        confirmLabel: 'Replace',
        destructive: true,
      }))
    ) {
      return;
    }
    tapLight();
    // Repeating keeps the original plan label, if it had one.
    draftActions.replace(
      blankDraftSets(workoutExercisesToDraft(workout.exercises, toCategory)),
      workout.template ?? null,
    );
    router.navigate('/');
  };

  const remove = async (workout: Workout) => {
    buzzWarning();
    if (
      await confirm({
        title: 'Delete this workout?',
        message: `${formatDate(workout.date)} · ${workout.exercises.length} exercises. This can't be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      })
    ) {
      void store.removeWorkout(workout.id);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader />
      <FlatList
        data={filtered}
        keyExtractor={(w) => w.id}
        extraData={openId}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {store.error && <ErrorBanner message={store.error} onDismiss={store.clearError} />}
            {sorted.length > 0 && (
              <View style={styles.filters}>
                {(['all', ...USERS] as const).map((f) => (
                  <Chip
                    key={f}
                    label={f === 'all' ? 'Everyone' : f}
                    active={filter === f}
                    activeColor={f === 'all' ? colors.ink : USER_COLORS[f]}
                    onPress={() => setFilter(f)}
                  />
                ))}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          sorted.length === 0 ? (
            <EmptyState
              plateLabel="?"
              title="No workouts logged yet."
              sub="Log your first one to see it here."
            />
          ) : (
            <EmptyState compact sub={`No workouts from ${filter} yet.`} />
          )
        }
        renderItem={({ item: w }) => {
          const { sets, volume } = workoutTotals(w);
          const open = openId === w.id;
          return (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${formatDate(w.date)}, ${w.user}, ${w.exercises.length} exercises, ${sets} sets, ${volume.toLocaleString()} pounds moved${w.template ? `, from plan ${w.template.name}` : ''}`}
                onPress={() => {
                  tapLight();
                  setOpenId(open ? null : w.id);
                }}
                style={({ pressed }) => [styles.summary, pressed && { opacity: 0.75 }]}>
                <Plate size={40} label={w.user[0]} color={USER_COLORS[w.user]} />
                <View style={styles.summaryMid}>
                  <Text style={styles.date}>{formatDate(w.date)}</Text>
                  {w.template && (
                    <View style={styles.planBadge}>
                      <Icon name="dumbbell" size={12} color={colors.goldDeep} />
                      <Text style={styles.planBadgeText} numberOfLines={1}>
                        {w.template.name}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.meta}>
                    {w.user} · {w.exercises.length} exercises · {sets} sets
                  </Text>
                </View>
                <View style={styles.summaryRight}>
                  <Text style={styles.volume}>{volume.toLocaleString()}</Text>
                  <Text style={styles.volumeUnit}>lbs moved</Text>
                </View>
                <Icon name={open ? 'chevron-up' : 'chevron-down'} color={colors.muted} />
              </Pressable>

              {open && (
                <View style={styles.detail}>
                  {w.exercises.map((ex, i) => {
                    const cat = toCategory[ex.name] || OTHER_CATEGORY;
                    const isCardio =
                      cat.label === CARDIO_LABEL || ex.sets.some((s) => s.time || s.intensity);
                    return (
                      <View key={i} style={styles.exercise}>
                        <View style={styles.exerciseName}>
                          <Dot color={cat.color} size={10} />
                          <Text style={styles.exerciseNameText}>{ex.name}</Text>
                        </View>
                        {ex.sets.map((s, j) => (
                          <Text key={j} style={styles.setLine}>
                            {isCardio
                              ? `${s.time} min · Intensity ${s.intensity}/10`
                              : `${s.reps} reps × ${s.weight} lbs`}
                          </Text>
                        ))}
                        {!!ex.notes && <Text style={styles.exerciseNotes}>&quot;{ex.notes}&quot;</Text>}
                      </View>
                    );
                  })}
                  <View style={styles.actions}>
                    <LinkButton icon="history" label="Repeat" onPress={() => repeat(w)} />
                    <LinkButton icon="plus" label="Save as Plan" onPress={() => setNamingPlanFor(w)} />
                    {w.user === user && (
                      <>
                        <LinkButton icon="pencil-outline" label="Edit" onPress={() => setEditing(w)} />
                        <LinkButton
                          icon="trash-can-outline"
                          label="Delete"
                          color={colors.danger}
                          onPress={() => remove(w)}
                        />
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />

      <EditWorkoutSheet workout={editing} onClose={() => setEditing(null)} />
      <PromptSheet
        visible={!!namingPlanFor}
        title="Name this plan"
        initialValue={
          namingPlanFor ? `${namingPlanFor.user}'s ${formatDate(namingPlanFor.date)} workout` : ''
        }
        confirmLabel="Save plan"
        onCancel={() => setNamingPlanFor(null)}
        onSubmit={async (name) => {
          const workout = namingPlanFor;
          setNamingPlanFor(null);
          if (workout && (await store.saveAsPlan(workout, name))) buzzSuccess();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 190,
    gap: 12,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 20,
    overflow: 'hidden',
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 72 },
  summaryMid: { flex: 1, gap: 3 },
  date: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,162,39,0.16)',
    maxWidth: '100%',
  },
  planBadgeText: {
    fontFamily: fonts.headingBold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.goldDeep,
    flexShrink: 1,
  },
  meta: { fontSize: 14, color: colors.muted },
  summaryRight: { alignItems: 'flex-end' },
  volume: { fontSize: 16, fontWeight: '700', color: colors.text },
  volumeUnit: { fontSize: 12, color: colors.muted },
  detail: {
    borderTopWidth: 2,
    borderTopColor: colors.line,
    padding: 14,
    gap: 12,
    backgroundColor: colors.bg,
  },
  exercise: { gap: 2 },
  exerciseName: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  exerciseNameText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  setLine: { fontSize: 15, color: colors.muted, marginLeft: 18 },
  exerciseNotes: { fontSize: 14, fontStyle: 'italic', color: colors.goldNote, marginLeft: 18, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4, marginTop: 2 },
});
