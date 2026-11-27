// LOG tab: start from a plan (or from scratch), type in sets, log the workout.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { KeyboardScroll } from '@/components/keyboard-scroll';
import { KeyboardSpace } from '@/components/keyboard-space';
import { ManageExercisesSheet } from '@/components/manage-exercises';
import { ProgressStrip } from '@/components/progress-strip';
import { NEW_ROUTINE, PlanEditorSheet } from '@/components/plan-editor-sheet';
import { useScrollBridge } from '@/components/sortable-list';
import { useGoPro } from '@/components/go-pro';
import { RoutinePicker, TIMER_ROOM } from '@/components/routine-picker';
import { StarterRoutinesSheet } from '@/components/starter-routines';
import { TogetherToggle } from '@/components/together-toggle';
import { ErrorBanner, OutlineButton } from '@/components/ui';
import { WorkoutForm } from '@/components/workout-form';
import { useLogDraft, useLogDraftActions } from '@/data/log-draft';
import { usePartner } from '@/data/partner';
import { useStore } from '@/data/store';
import { confirm } from '@/lib/dialogs';
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
  const goPro = useGoPro();

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
    else void goPro.offer(PLAN_LIMIT_TITLE, PLAN_LIMIT_MESSAGE);
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
            <RoutinePicker
              templates={db.templates}
              current={draft.template?.name ?? null}
              onStart={(t) => void loadPlan(t)}
              onEdit={(t) => setEditingPlan(t)}
              onDelete={deletePlan}
              onNew={newRoutine}
              onStarters={() => setStarters(true)}
            />
          )}

          {otherUser && (
            <TogetherToggle
              on={togetherMode}
              onChange={store.setTogetherMode}
              user={user}
              otherUser={otherUser}
              names={names}
            />
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
      {goPro.sheet}
    </KeyboardSpace>
  );
}

const styles = themed(() => StyleSheet.create({
  pressed: { opacity: 0.6 },
  noRoutines: {
    marginRight: TIMER_ROOM,
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
