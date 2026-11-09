// LOG tab: start from a plan (or from scratch), type in sets, log the workout.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { KeyboardScroll } from '@/components/keyboard-scroll';
import { KeyboardSpace } from '@/components/keyboard-space';
import { ManageExercisesSheet } from '@/components/manage-exercises';
import { PlanEditorSheet } from '@/components/plan-editor-sheet';
import { useScrollBridge } from '@/components/sortable-list';
import { TogetherToggle } from '@/components/together-toggle';
import { ErrorBanner, Icon, OutlineButton } from '@/components/ui';
import { WorkoutForm } from '@/components/workout-form';
import { useLogDraft, useLogDraftActions } from '@/data/log-draft';
import { useStore } from '@/data/store';
import { confirm } from '@/lib/dialogs';
import { templateToDraft } from '@/lib/draft';
import { buzzWarning, tapLight } from '@/lib/haptics';
import { computeLastPerformance, formatDraftTime } from '@/lib/stats';
import type { Workout, WorkoutTemplate } from '@/lib/types';
import { uid } from '@/lib/workout-data';
import { colors, fonts } from '@/theme';

export default function LogScreen() {
  const store = useStore();
  const draft = useLogDraft();
  const actions = useLogDraftActions();
  // The bottom 170 points are covered by the tab bar and the rest timer.
  const { bridge, scrollProps, hostProps, overlay } = useScrollBridge(170);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WorkoutTemplate | null>(null);
  const [managing, setManaging] = useState(false);

  const { user, otherUser, togetherMode, db } = store;
  if (!user || !otherUser) return null;

  const loadPlan = async (plan: WorkoutTemplate) => {
    // Starting a plan replaces the unsaved workout, so ask first.
    if (
      actions.hasEntries() &&
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
    actions.replace(templateToDraft(plan.exercises, store.toCategory), {
      id: plan.id,
      name: plan.name,
    });
    bridge.ref.current?.scrollTo({ y: 0, animated: true });
  };

  const deletePlan = async (plan: WorkoutTemplate) => {
    buzzWarning();
    if (
      await confirm({
        title: `Delete the "${plan.name}" plan?`,
        message: 'Workouts already logged from it stay in History.',
        confirmLabel: 'Delete',
        destructive: true,
      })
    ) {
      void store.removeTemplate(plan.id);
    }
  };

  const startFresh = async () => {
    if (
      await confirm({
        title: 'Clear this unsaved workout and start fresh?',
        confirmLabel: 'Start fresh',
        destructive: true,
      })
    ) {
      actions.reset();
    }
  };

  return (
    <KeyboardSpace>
      <AppHeader />
      <View {...hostProps}>
        <KeyboardScroll {...scrollProps} bottomSpace={190}>
          {store.error && <ErrorBanner message={store.error} onDismiss={store.clearError} />}

          <TogetherToggle
            on={togetherMode}
            onChange={store.setTogetherMode}
            user={user}
            otherUser={otherUser}
          />

          {db.templates.length > 0 && (
            <View style={styles.plans}>
              <Text style={styles.plansLabel}>START FROM A PLAN</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.planChips}
              >
                {db.templates.map((t) => (
                  <View key={t.id} style={styles.planChip}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Start from plan ${t.name}`}
                      onPress={() => loadPlan(t)}
                      style={({ pressed }) => [styles.planChipMain, pressed && styles.pressed]}
                    >
                      <Icon name="dumbbell" size={16} color={colors.text} />
                      <Text style={styles.planChipText}>{t.name}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${t.name} plan`}
                      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                      onPress={() => setEditingPlan(t)}
                      style={({ pressed }) => [styles.planChipIcon, pressed && styles.pressed]}
                    >
                      <Icon name="pencil-outline" size={17} color={colors.muted} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${t.name} plan`}
                      hitSlop={{ top: 10, bottom: 10, left: 4, right: 8 }}
                      onPress={() => deletePlan(t)}
                      style={({ pressed }) => [styles.planChipIcon, pressed && styles.pressed]}
                    >
                      <Icon name="close" size={17} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {draft.restoredAt && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                <Text style={styles.bannerStrong}>Unsaved workout restored</Text>
                {formatDraftTime(draft.restoredAt) &&
                  ` · last edited ${formatDraftTime(draft.restoredAt)}`}
                {'\n'}Tap Log Workout when you&apos;re done to save it.
              </Text>
              <OutlineButton compact label="Start fresh" onPress={startFresh} />
            </View>
          )}

          <WorkoutForm
            date={draft.date}
            onChangeDate={actions.setDate}
            exercises={draft.exercises}
            onChangeExercises={actions.setExercises}
            template={draft.template}
            submitLabel={togetherMode ? 'LOG BOTH WORKOUTS' : 'LOG WORKOUT'}
            saving={saving}
            groups={store.groups}
            toCategory={store.toCategory}
            lastPerformance={computeLastPerformance(db.workouts, user)}
            lastPerformanceOther={computeLastPerformance(db.workouts, otherUser)}
            togetherMode={togetherMode}
            currentUser={user}
            otherUser={otherUser}
            notesApi={store.notesApi}
            templates={db.templates}
            onSavePlanOrder={store.savePlanOrder}
            onManageExercises={() => setManaging(true)}
            scroll={bridge}
            onSubmit={async (built) => {
              const now = new Date().toISOString();
              const mine: Workout = {
                id: uid(),
                user,
                date: built.date,
                exercises: built.exercises,
                notes: '',
                loggedAt: now,
                template: draft.template,
              };
              setSaving(true);
              const ok = togetherMode
                ? await store.addWorkoutForBoth(mine, {
                    ...mine,
                    id: uid(),
                    user: otherUser,
                    exercises: built.exercisesOther,
                  })
                : await store.addWorkout(mine);
              setSaving(false);
              if (ok) {
                built.toRegister.forEach((r) => store.registerExercise(r.name, r.category));
                // Anything typed in a note box but not saved yet joins the saved
                // notes list too, so it shows up next time.
                for (const n of built.notesToSave) await store.notesApi.add(n.user, n.name, n.text);
                actions.reset();
                bridge.ref.current?.scrollTo({ y: 0, animated: true });
              }
              return ok;
            }}
          />
        </KeyboardScroll>
        {overlay}
      </View>

      <PlanEditorSheet template={editingPlan} onClose={() => setEditingPlan(null)} />
      <ManageExercisesSheet visible={managing} onClose={() => setManaging(false)} />
    </KeyboardSpace>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  plans: { marginBottom: 16 },
  plansLabel: {
    fontFamily: fonts.headingBold,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.muted,
    marginBottom: 8,
  },
  planChips: { gap: 8, paddingRight: 8 },
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  planChipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 42,
    paddingRight: 6,
  },
  planChipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  planChipIcon: { width: 30, height: 42, alignItems: 'center', justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,162,39,0.14)',
  },
  bannerText: { flex: 1, fontSize: 14, color: colors.ink },
  bannerStrong: { fontWeight: '700' },
});
