// LOG tab: start from a plan (or from scratch), type in sets, log the workout.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { KeyboardScroll } from '@/components/keyboard-scroll';
import { KeyboardSpace } from '@/components/keyboard-space';
import { ManageExercisesSheet } from '@/components/manage-exercises';
import { ProgressStrip } from '@/components/progress-strip';
import { NEW_ROUTINE, PlanEditorSheet } from '@/components/plan-editor-sheet';
import { useScrollBridge } from '@/components/sortable-list';
import { StarterRoutinesSheet } from '@/components/starter-routines';
import { TogetherToggle } from '@/components/together-toggle';
import { ErrorBanner, Icon, OutlineButton } from '@/components/ui';
import { WorkoutForm } from '@/components/workout-form';
import { useLogDraft, useLogDraftActions } from '@/data/log-draft';
import { usePartner } from '@/data/partner';
import { useStore } from '@/data/store';
import { confirm, notify } from '@/lib/dialogs';
import { draftProgress, templateToDraft } from '@/lib/draft';
import { buzzWarning, tapLight } from '@/lib/haptics';
import { PLAN_LIMIT_MESSAGE, PLAN_LIMIT_TITLE } from '@/lib/pro';
import { computeLastPerformance, formatDraftTime } from '@/lib/stats';
import type { Workout, WorkoutTemplate } from '@/lib/types';
import { uid } from '@/lib/workout-data';
import { colors, fonts, themed } from '@/theme';

export default function LogScreen() {
  const store = useStore();
  const draft = useLogDraft();
  const actions = useLogDraftActions();
  const partner = usePartner();
  // The bottom 170 points are covered by the tab bar and the rest timer.
  const { bridge, scrollProps, hostProps, overlay } = useScrollBridge(170);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WorkoutTemplate | null>(null);
  const [managing, setManaging] = useState(false);
  const [starters, setStarters] = useState(false);

  const { user, otherUser, names, togetherMode, db } = store;
  // Only shown or logged in Together Mode, which needs a partner switched on.
  const other = otherUser ?? 'partner';

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
        title: `Delete the "${plan.name}" routine?`,
        message: 'Workouts already logged from it stay in History.',
        confirmLabel: 'Delete',
        destructive: true,
      })
    ) {
      void store.removeTemplate(plan.id);
    }
  };

  const progress = draftProgress(draft.exercises, togetherMode);

  const newRoutine = () => {
    tapLight();
    if (store.canAddRoutine) setEditingPlan(NEW_ROUTINE);
    else void notify(PLAN_LIMIT_TITLE, PLAN_LIMIT_MESSAGE);
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

          {otherUser && (
            <TogetherToggle
              on={togetherMode}
              onChange={store.setTogetherMode}
              user={user}
              otherUser={otherUser}
              names={names}
            />
          )}

          {db.templates.length === 0 && (
            <View style={styles.noRoutines}>
              <Text style={styles.noRoutinesTitle}>No routines yet</Text>
              <Text style={styles.noRoutinesText}>
                A routine is a workout you repeat. Pick it and your exercises are ready to log.
              </Text>
              <View style={styles.noRoutinesButtons}>
                <OutlineButton compact icon="plus" label="New routine" onPress={newRoutine} />
                <OutlineButton compact label="Starter routines" onPress={() => setStarters(true)} />
              </View>
            </View>
          )}

          {db.templates.length > 0 && (
            <View style={styles.plans}>
              <View style={styles.plansHead}>
                <Text style={styles.plansLabel}>START FROM A ROUTINE</Text>
                <View style={styles.plansLinks}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Starter routines"
                    hitSlop={10}
                    onPress={() => setStarters(true)}
                    style={({ pressed }) => [styles.newRoutine, pressed && styles.pressed]}
                  >
                    <Text style={styles.newRoutineText}>Starters</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="New routine"
                    hitSlop={10}
                    onPress={newRoutine}
                    style={({ pressed }) => [styles.newRoutine, pressed && styles.pressed]}
                  >
                    <Icon name="plus" size={16} color={colors.goldDeep} />
                    <Text style={styles.newRoutineText}>New</Text>
                  </Pressable>
                </View>
              </View>
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
                      accessibilityLabel={`Start from routine ${t.name}`}
                      onPress={() => loadPlan(t)}
                      style={({ pressed }) => [styles.planChipMain, pressed && styles.pressed]}
                    >
                      <Icon name="dumbbell" size={16} color={colors.text} />
                      <Text style={styles.planChipText}>{t.name}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${t.name} routine`}
                      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                      onPress={() => setEditingPlan(t)}
                      style={({ pressed }) => [styles.planChipIcon, pressed && styles.pressed]}
                    >
                      <Icon name="pencil-outline" size={17} color={colors.muted} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${t.name} routine`}
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

          {progress.total >= 2 && <ProgressStrip {...progress} />}

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
            lastPerformanceOther={computeLastPerformance(db.workouts, other)}
            togetherMode={togetherMode}
            currentUser={user}
            otherUser={other}
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
              const theirs: Workout = { ...mine, id: uid(), user: other, exercises: built.exercisesOther };
              const ok = togetherMode
                ? await store.addWorkoutForBoth(mine, theirs)
                : await store.addWorkout(mine);
              setSaving(false);
              if (ok) {
                // With a partner's phone linked, a session logged for both goes to it too.
                if (togetherMode) partner.share(mine, theirs);
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
      <StarterRoutinesSheet visible={starters} onClose={() => setStarters(false)} />
    </KeyboardSpace>
  );
}

const styles = themed(() => StyleSheet.create({
  pressed: { opacity: 0.6 },
  plans: { marginBottom: 16 },
  plansHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plansLinks: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  newRoutine: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  newRoutineText: { fontSize: 15, fontWeight: '700', color: colors.goldDeep },
  noRoutines: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  noRoutinesTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  noRoutinesText: { fontSize: 15, lineHeight: 21, color: colors.muted },
  noRoutinesButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
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
    backgroundColor: colors.goldTint,
  },
  bannerText: { flex: 1, fontSize: 14, color: colors.text },
  bannerStrong: { fontWeight: '700' },
}));
