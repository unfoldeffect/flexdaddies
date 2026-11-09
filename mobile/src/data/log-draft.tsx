// The workout being typed on the Log tab.
//
// It is saved to the phone as you type, so closing the app, a restart, or
// tapping Switch never loses it. It is cleared once the workout is logged.
// Each person has their own unfinished workout.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  draftHasContent,
  draftHasEntries,
  emptyExercise,
  type DraftExercise,
  type SavedDraft,
} from '../lib/draft';
import type { TemplateLink } from '../lib/types';
import { todayISO, type WorkoutUser } from '../lib/workout-data';
import { clearDraft, loadDraft, saveDraft } from './storage';
import { useStore } from './store';

type DraftState = {
  date: string;
  exercises: DraftExercise[];
  /** The plan this workout was started from, so History can show it. */
  template: TemplateLink | null;
  /** When set, an unfinished workout was brought back (shows a banner). */
  restoredAt: string | null;
};

const freshDraft = (): DraftState => ({
  date: todayISO(),
  exercises: [emptyExercise()],
  template: null,
  restoredAt: null,
});

export type LogDraftActions = {
  setDate: (date: string) => void;
  setExercises: (update: (prev: DraftExercise[]) => DraftExercise[]) => void;
  /** True when reps, weight, time or intensity has been typed in. */
  hasEntries: () => boolean;
  /** Replaces the workout on the Log tab (from a plan or "Repeat"). */
  replace: (exercises: DraftExercise[], template: TemplateLink | null) => void;
  /** Back to an empty form (after logging, or "Start fresh"). */
  reset: () => void;
};

const DraftStateContext = createContext<(DraftState & { loaded: boolean }) | null>(null);
const DraftActionsContext = createContext<LogDraftActions | null>(null);

export function useLogDraft() {
  const state = useContext(DraftStateContext);
  if (!state) throw new Error('useLogDraft must be used inside <LogDraftProvider>');
  return state;
}

/** Stable functions only: using this does not re-render on every keystroke. */
export function useLogDraftActions(): LogDraftActions {
  const actions = useContext(DraftActionsContext);
  if (!actions) throw new Error('useLogDraftActions must be used inside <LogDraftProvider>');
  return actions;
}

const SAVE_DELAY_MS = 400;

export function LogDraftProvider({ children }: { children: React.ReactNode }) {
  const { user, togetherMode, setTogetherMode } = useStore();
  const [state, setState] = useState<DraftState>(freshDraft);
  const [loadedFor, setLoadedFor] = useState<WorkoutUser | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Bring back this person's unfinished workout when they are chosen.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadDraft(user).then((saved) => {
      if (cancelled) return;
      if (saved && draftHasContent(saved.exercises)) {
        setState({
          date: saved.date || todayISO(),
          exercises: saved.exercises,
          template: saved.template ?? null,
          restoredAt: saved.savedAt,
        });
        if (saved.togetherMode) setTogetherMode(true);
      } else {
        setState(freshDraft());
      }
      setLoadedFor(user);
    });
    return () => {
      cancelled = true;
    };
  }, [user, setTogetherMode]);

  // Save as you type (shortly after the last change).
  const loaded = !!user && loadedFor === user;
  useEffect(() => {
    if (!user || !loaded) return;
    const timer = setTimeout(() => {
      if (draftHasContent(state.exercises)) {
        const draft: SavedDraft = {
          date: state.date,
          exercises: state.exercises,
          togetherMode,
          savedAt: new Date().toISOString(),
          template: state.template,
        };
        void saveDraft(user, draft);
      } else {
        void clearDraft(user);
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [user, loaded, state.date, state.exercises, state.template, togetherMode]);

  const setDate = useCallback((date: string) => setState((s) => ({ ...s, date })), []);
  const setExercises = useCallback(
    (update: (prev: DraftExercise[]) => DraftExercise[]) =>
      setState((s) => {
        const exercises = update(s.exercises);
        return exercises === s.exercises ? s : { ...s, exercises };
      }),
    [],
  );
  const hasEntries = useCallback(() => draftHasEntries(stateRef.current.exercises), []);
  const replace = useCallback(
    (exercises: DraftExercise[], template: TemplateLink | null) =>
      setState({ date: todayISO(), exercises, template, restoredAt: null }),
    [],
  );
  const reset = useCallback(() => setState(freshDraft()), []);

  const actions = useMemo<LogDraftActions>(
    () => ({ setDate, setExercises, hasEntries, replace, reset }),
    [setDate, setExercises, hasEntries, replace, reset],
  );
  const value = useMemo(() => ({ ...state, loaded }), [state, loaded]);

  return (
    <DraftActionsContext.Provider value={actions}>
      <DraftStateContext.Provider value={value}>{children}</DraftStateContext.Provider>
    </DraftActionsContext.Provider>
  );
}
