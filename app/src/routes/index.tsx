import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  BarChartIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DumbbellIcon,
  EditIcon,
  HistoryIcon,
  PlusIcon,
  ScaleIcon,
  TrashIcon,
  UserIcon,
  XIcon,
} from "../components/icons";
import { RestTimer } from "../components/rest-timer";
import {
  addCustomExercise,
  listCustomExercises,
  type CustomExercise,
} from "../lib/api/custom-exercises.functions";
import {
  createWeighIn,
  deleteWeighIn,
  listWeighIns,
  type WeighIn,
} from "../lib/api/weigh-ins.functions";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  type TemplateExercise,
  type WorkoutTemplate,
} from "../lib/api/workout-templates.functions";
import {
  createWorkout,
  deleteWorkout,
  listWorkouts,
  updateWorkout,
  type Workout,
} from "../lib/api/workouts.functions";
import {
  CARDIO_LABEL,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  NUM_SETS,
  OTHER_CATEGORY,
  OTHER_VALUE,
  USERS,
  USER_COLORS,
  formatDate,
  hexToRgba,
  mergeExerciseGroups,
  todayISO,
  uid,
  type CategoryInfo,
  type ExerciseGroup,
  type WorkoutUser,
} from "../lib/workout-data";

export const Route = createFileRoute("/")({
  loader: async () => ({
    workouts: await listWorkouts(),
    weighIns: await listWeighIns(),
    customExercises: await listCustomExercises(),
    templates: await listTemplates(),
  }),
  component: Index,
});

type DraftSet = { id: string; reps: string; weight: string; time: string; intensity: string };
type DraftExercise = {
  id: string;
  name: string;
  customName: string;
  customCategory: string;
  sets: DraftSet[];
  setsOther: DraftSet[];
  targetReps?: string;
  notes: string;
};

function makeSets(count: number = NUM_SETS): DraftSet[] {
  const n = Math.max(1, Math.min(count, NUM_SETS));
  return Array.from({ length: n }, () => ({
    id: uid(),
    reps: "",
    weight: "",
    time: "",
    intensity: "",
  }));
}

// Cardio exercises always get exactly one set; everything else is capped at
// NUM_SETS. Preserves existing set values where possible instead of blanking.
function clampSetsForCategory(sets: DraftSet[], isCardio: boolean): DraftSet[] {
  if (isCardio) {
    return sets.length ? [sets[0]] : [{ id: uid(), reps: "", weight: "", time: "", intensity: "" }];
  }
  if (sets.length >= NUM_SETS) return sets.slice(0, NUM_SETS);
  const padded = [...sets];
  while (padded.length < NUM_SETS) {
    padded.push({ id: uid(), reps: "", weight: "", time: "", intensity: "" });
  }
  return padded;
}

function emptyExercise(): DraftExercise {
  return {
    id: uid(),
    name: "",
    customName: "",
    customCategory: "",
    sets: makeSets(),
    setsOther: makeSets(),
    notes: "",
  };
}

function templateToDraft(
  items: TemplateExercise[],
  toCategory: Record<string, CategoryInfo>,
): DraftExercise[] {
  if (!items.length) return [emptyExercise()];
  return items.map((t) => {
    const known = !!toCategory[t.name];
    const isCardio = toCategory[t.name]?.label === CARDIO_LABEL;
    const count = isCardio ? 1 : Math.max(1, t.sets);
    return {
      id: uid(),
      name: known ? t.name : OTHER_VALUE,
      customName: known ? "" : t.name,
      customCategory: "",
      sets: makeSets(count),
      setsOther: makeSets(count),
      targetReps: t.reps,
      notes: "",
    };
  });
}

function blankDraftSets(exercises: DraftExercise[]): DraftExercise[] {
  return exercises.map((ex) => ({
    ...ex,
    id: uid(),
    sets: ex.sets.map(() => ({ id: uid(), reps: "", weight: "", time: "", intensity: "" })),
    setsOther: ex.setsOther.map(() => ({
      id: uid(),
      reps: "",
      weight: "",
      time: "",
      intensity: "",
    })),
    notes: "",
  }));
}

function resolveCategory(
  ex: DraftExercise,
  toCategory: Record<string, CategoryInfo>,
): CategoryInfo | null {
  if (!ex.name) return null;
  if (ex.name === OTHER_VALUE) {
    if (!ex.customCategory) return OTHER_CATEGORY;
    return {
      label: ex.customCategory,
      color: CATEGORY_COLORS[ex.customCategory] ?? OTHER_CATEGORY.color,
    };
  }
  return toCategory[ex.name] || OTHER_CATEGORY;
}

function Plate({ size = 28, label, color }: { size?: number; label: string; color?: string }) {
  const bg = color || "#2555c7";
  return (
    <div
      className="plate"
      style={{ width: size, height: size, fontSize: size * 0.36, background: bg }}
    >
      {label}
    </div>
  );
}

function ProfileSelect({ onSelect }: { onSelect: (user: WorkoutUser) => void }) {
  return (
    <div className="hero-wrap">
      <img src="/assets/flexdaddies-logo.png" alt="Flex Daddies" className="hero-logo" />
      <div className="hero-card">
        <div className="hero-dots" />
        <p className="hero-prompt">Who's lifting today?</p>
        <div className="pill-btn-col">
          {USERS.map((u) => (
            <button key={u} className="pill-btn" onClick={() => onSelect(u)}>
              <span className="pill-btn-dot" style={{ background: USER_COLORS[u] }}>
                {u[0]}
              </span>
              {u.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExerciseEditor({
  exercise,
  onChange,
  onRemove,
  showRemove,
  groups,
  toCategory,
  lastPerformance,
  togetherMode,
  currentUser,
  otherUser,
  lastPerformanceOther,
}: {
  exercise: DraftExercise;
  onChange: (updated: DraftExercise) => void;
  onRemove: () => void;
  showRemove: boolean;
  groups: ExerciseGroup[];
  toCategory: Record<string, CategoryInfo>;
  lastPerformance: Record<string, Workout["exercises"][number]>;
  togetherMode: boolean;
  currentUser: WorkoutUser;
  otherUser: WorkoutUser;
  lastPerformanceOther: Record<string, Workout["exercises"][number]>;
}) {
  const updateSet = (
    setId: string,
    field: "reps" | "weight" | "time" | "intensity",
    value: string,
  ) => {
    onChange({
      ...exercise,
      sets: exercise.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
    });
  };

  const updateOtherSet = (
    setId: string,
    field: "reps" | "weight" | "time" | "intensity",
    value: string,
  ) => {
    onChange({
      ...exercise,
      setsOther: exercise.setsOther.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
    });
  };

  const handleNameChange = (name: string) => {
    const isCardioNext = name !== OTHER_VALUE && toCategory[name]?.label === CARDIO_LABEL;
    onChange({
      ...exercise,
      name,
      sets: clampSetsForCategory(exercise.sets, isCardioNext),
      setsOther: clampSetsForCategory(exercise.setsOther, isCardioNext),
    });
  };

  const isOther = exercise.name === OTHER_VALUE;
  const category = resolveCategory(exercise, toCategory);
  const accent = category ? category.color : "#dbe0d6";
  const isCardio = category?.label === CARDIO_LABEL;

  const renderLastWorkout = (
    history: Record<string, Workout["exercises"][number]>,
    cardio: boolean,
  ) => {
    if (isOther || !exercise.name || !history[exercise.name]?.sets.length) return null;
    const entry = history[exercise.name];
    return (
      <p className="target-reps-note target-reps-note--history">
        Last workout:{" "}
        {entry.sets
          .filter((s) => (cardio ? s.time || s.intensity : s.reps || s.weight))
          .map((s) => (cardio ? `${s.time}min @ ${s.intensity}/10` : `${s.reps}×${s.weight}lbs`))
          .join(", ")}
        {entry.notes && (
          <>
            <br />
            <span className="target-reps-note--quote">"{entry.notes}"</span>
          </>
        )}
      </p>
    );
  };

  const renderSetRows = (
    sets: DraftSet[],
    onSetChange: (
      id: string,
      field: "reps" | "weight" | "time" | "intensity",
      value: string,
    ) => void,
    cardio: boolean,
  ) => (
    <div className="set-rows">
      <div className="set-row set-row--header">
        <span>SET</span>
        {cardio ? (
          <>
            <span>TIME (MIN)</span>
            <span>INTENSITY (1-10)</span>
          </>
        ) : (
          <>
            <span>REPS</span>
            <span>WEIGHT (LBS)</span>
          </>
        )}
      </div>
      {sets.map((s, i) => (
        <div className="set-row" key={s.id}>
          <span className="set-index" style={{ background: accent }}>
            {i + 1}
          </span>
          {cardio ? (
            <>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={s.time}
                onChange={(e) => onSetChange(s.id, "time", e.target.value)}
              />
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="10"
                placeholder="0"
                value={s.intensity}
                onChange={(e) => onSetChange(s.id, "intensity", e.target.value)}
              />
            </>
          ) : (
            <>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={s.reps}
                onChange={(e) => onSetChange(s.id, "reps", e.target.value)}
              />
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={s.weight}
                onChange={(e) => onSetChange(s.id, "weight", e.target.value)}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="exercise-card" style={{ borderColor: category ? accent : undefined }}>
      <div className="exercise-head">
        <div className="exercise-field">
          {category && (
            <span
              className="category-tile"
              style={{ color: category.color, background: hexToRgba(category.color, 0.14) }}
            >
              <span className="category-tile-dot" style={{ background: category.color }} />
              {category.label}
            </span>
          )}
          <label className="field-label">EXERCISE</label>
          <select
            className="exercise-select"
            value={exercise.name}
            onChange={(e) => handleNameChange(e.target.value)}
          >
            <option value="" disabled>
              Choose an exercise
            </option>
            {groups.map((g) => (
              <optgroup label={g.label.toUpperCase()} key={g.label} style={{ color: g.color }}>
                {g.options.map((opt) => (
                  <option value={opt} key={opt}>
                    {opt}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={OTHER_VALUE}>Other (type your own)</option>
          </select>
          {isOther && (
            <>
              <input
                className="exercise-custom-input"
                type="text"
                placeholder="Type exercise name"
                value={exercise.customName}
                onChange={(e) => onChange({ ...exercise, customName: e.target.value })}
              />
              <select
                className="exercise-custom-input exercise-category-select"
                value={exercise.customCategory}
                onChange={(e) => {
                  const cat = e.target.value;
                  const cardioNext = cat === CARDIO_LABEL;
                  onChange({
                    ...exercise,
                    customCategory: cat,
                    sets: clampSetsForCategory(exercise.sets, cardioNext),
                    setsOther: clampSetsForCategory(exercise.setsOther, cardioNext),
                  });
                }}
              >
                <option value="">Category: Other</option>
                {CATEGORY_LABELS.map((label) => (
                  <option value={label} key={label}>
                    Category: {label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        {showRemove && (
          <button className="icon-btn" onClick={onRemove} aria-label="Remove exercise">
            <XIcon size={20} />
          </button>
        )}
      </div>

      {togetherMode && (
        <p className="together-person-label" style={{ color: USER_COLORS[currentUser] }}>
          {currentUser}
        </p>
      )}
      {renderLastWorkout(lastPerformance, isCardio)}
      {renderSetRows(exercise.sets, updateSet, isCardio)}

      {togetherMode && (
        <>
          <p
            className="together-person-label together-person-label--second"
            style={{ color: USER_COLORS[otherUser] }}
          >
            {otherUser}
          </p>
          {renderLastWorkout(lastPerformanceOther, isCardio)}
          {renderSetRows(exercise.setsOther, updateOtherSet, isCardio)}
        </>
      )}
      <div className="exercise-notes-block">
        <label className="field-label" htmlFor={`exercise-notes-${exercise.id}`}>
          NOTES <span className="field-label-sub">(optional)</span>
        </label>
        <textarea
          id={`exercise-notes-${exercise.id}`}
          className="exercise-notes-input"
          placeholder="Form cues, how it felt, anything to remember..."
          value={exercise.notes}
          onChange={(e) => onChange({ ...exercise, notes: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}

function workoutExercisesToDraft(
  exercises: Workout["exercises"],
  toCategory: Record<string, CategoryInfo>,
): DraftExercise[] {
  if (!exercises.length) return [emptyExercise()];
  return exercises.map((ex) => {
    const cat = toCategory[ex.name];
    const known = !!cat;
    const isCardio =
      cat?.label === CARDIO_LABEL || (!known && ex.sets.some((s) => s.time || s.intensity));
    const rawSets: DraftSet[] = ex.sets.map((s) => ({
      id: uid(),
      reps: isCardio ? "" : String(s.reps),
      weight: isCardio ? "" : String(s.weight),
      time: isCardio ? String(s.time) : "",
      intensity: isCardio ? String(s.intensity) : "",
    }));
    const sets = clampSetsForCategory(rawSets, isCardio);
    return {
      id: uid(),
      name: known ? ex.name : OTHER_VALUE,
      customName: known ? "" : ex.name,
      customCategory: known ? "" : isCardio ? CARDIO_LABEL : "",
      sets,
      setsOther: makeSets(sets.length),
      notes: ex.notes || "",
    };
  });
}

function WorkoutForm({
  initialDate,
  initialExercises,
  submitLabel,
  savingLabel,
  onSubmit,
  onCancel,
  onRegisterExercise,
  groups,
  toCategory,
  lastPerformance,
  saving,
  togetherMode = false,
  currentUser,
  otherUser,
  lastPerformanceOther,
}: {
  initialDate: string;
  initialExercises: DraftExercise[];
  submitLabel: string;
  savingLabel: string;
  onSubmit: (data: {
    date: string;
    exercises: Workout["exercises"];
    exercisesOther?: Workout["exercises"];
    notes: string;
  }) => Promise<boolean>;
  onCancel?: () => void;
  onRegisterExercise: (name: string, category: string) => void;
  groups: ExerciseGroup[];
  toCategory: Record<string, CategoryInfo>;
  lastPerformance: Record<string, Workout["exercises"][number]>;
  saving: boolean;
  togetherMode?: boolean;
  currentUser: WorkoutUser;
  otherUser: WorkoutUser;
  lastPerformanceOther?: Record<string, Workout["exercises"][number]>;
}) {
  const [date, setDate] = useState(initialDate);
  const [exercises, setExercises] = useState<DraftExercise[]>(initialExercises);
  const [justSaved, setJustSaved] = useState(false);

  const updateExercise = (id: string, updated: DraftExercise) =>
    setExercises((prev) => prev.map((ex) => (ex.id === id ? updated : ex)));
  const removeExercise = (id: string) => setExercises((prev) => prev.filter((ex) => ex.id !== id));
  const addExercise = () => setExercises((prev) => [...prev, emptyExercise()]);

  const finalName = (ex: DraftExercise) =>
    ex.name === OTHER_VALUE ? ex.customName.trim() : ex.name;

  const canSave = exercises.some(
    (ex) =>
      finalName(ex) &&
      (ex.sets.some((s) => s.reps || s.weight || s.time || s.intensity) ||
        (togetherMode && ex.setsOther.some((s) => s.reps || s.weight || s.time || s.intensity))),
  );

  const cleanSets = (sets: DraftSet[], isCardio: boolean) =>
    isCardio
      ? sets
          .filter((s) => s.time !== "" || s.intensity !== "")
          .map((s) => ({
            reps: 0,
            weight: 0,
            time: Number(s.time) || 0,
            intensity: Number(s.intensity) || 0,
          }))
      : sets
          .filter((s) => s.reps !== "" || s.weight !== "")
          .map((s) => ({
            reps: Number(s.reps) || 0,
            weight: Number(s.weight) || 0,
            time: 0,
            intensity: 0,
          }));

  const handleSave = async () => {
    const cleaned: Workout["exercises"] = [];
    const cleanedOther: Workout["exercises"] = [];
    const toRegister: { name: string; category: string }[] = [];

    for (const ex of exercises) {
      const name = finalName(ex);
      if (!name) continue;
      const isCardio = resolveCategory(ex, toCategory)?.label === CARDIO_LABEL;
      const sets = cleanSets(ex.sets, isCardio);
      if (sets.length) cleaned.push({ name, sets, notes: ex.notes.trim() });
      if (togetherMode) {
        const setsOther = cleanSets(ex.setsOther, isCardio);
        if (setsOther.length) cleanedOther.push({ name, sets: setsOther, notes: ex.notes.trim() });
      }
      if (sets.length && ex.name === OTHER_VALUE) {
        toRegister.push({ name, category: ex.customCategory || OTHER_CATEGORY.label });
      }
    }

    if (!cleaned.length && !cleanedOther.length) return;

    const ok = await onSubmit({
      date,
      exercises: cleaned,
      exercisesOther: togetherMode ? cleanedOther : undefined,
      notes: "",
    });
    if (ok) {
      toRegister.forEach((r) => onRegisterExercise(r.name, r.category));
    }
    if (ok && !onCancel) {
      setExercises([emptyExercise()]);
      setDate(todayISO());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2200);
    }
  };

  return (
    <div className="view">
      <div className="log-date-row">
        <label className="field-label" htmlFor="workout-date">
          DATE
        </label>
        <input
          id="workout-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {exercises.map((ex) => (
        <ExerciseEditor
          key={ex.id}
          exercise={ex}
          onChange={(updated) => updateExercise(ex.id, updated)}
          onRemove={() => removeExercise(ex.id)}
          showRemove={exercises.length > 1}
          groups={groups}
          toCategory={toCategory}
          lastPerformance={lastPerformance}
          togetherMode={togetherMode}
          currentUser={currentUser}
          otherUser={otherUser}
          lastPerformanceOther={lastPerformanceOther ?? {}}
        />
      ))}

      <button className="add-exercise-btn" onClick={addExercise}>
        <PlusIcon size={20} /> Add Another Exercise
      </button>

      <div className={onCancel ? "edit-form-actions" : undefined}>
        <button className="save-btn" onClick={handleSave} disabled={!canSave || saving}>
          {saving ? savingLabel : justSaved ? "SAVED ✓" : submitLabel}
        </button>
        {onCancel && (
          <button className="cancel-edit-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function LogView({
  user,
  otherUser,
  onSave,
  onSaveBoth,
  onRegisterExercise,
  groups,
  toCategory,
  saving,
  templates,
  onLoadTemplate,
  onDeleteTemplate,
  seedExercises,
  seedKey,
  lastPerformance,
  lastPerformanceOther,
  togetherMode,
  setTogetherMode,
}: {
  user: WorkoutUser;
  otherUser: WorkoutUser;
  onSave: (workout: Workout) => Promise<boolean>;
  onSaveBoth: (workout: Workout, workoutOther: Workout) => Promise<boolean>;
  onRegisterExercise: (name: string, category: string) => void;
  groups: ExerciseGroup[];
  toCategory: Record<string, CategoryInfo>;
  saving: boolean;
  templates: WorkoutTemplate[];
  onLoadTemplate: (template: WorkoutTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  seedExercises: DraftExercise[] | null;
  seedKey: number;
  lastPerformance: Record<string, Workout["exercises"][number]>;
  lastPerformanceOther: Record<string, Workout["exercises"][number]>;
  togetherMode: boolean;
  setTogetherMode: (v: boolean) => void;
}) {
  return (
    <>
      <button
        className={`together-toggle ${togetherMode ? "together-toggle--active" : ""}`}
        onClick={() => setTogetherMode(!togetherMode)}
      >
        <span className="together-toggle-dots">
          <span style={{ background: USER_COLORS[user] }} />
          <span style={{ background: USER_COLORS[otherUser] }} />
        </span>
        Together Mode
        <span className="together-toggle-switch">
          <span className="together-toggle-knob" />
        </span>
      </button>

      {templates.length > 0 && (
        <div className="plans-row">
          <div className="plans-row-label">START FROM A PLAN</div>
          <div className="plans-chip-scroll">
            {templates.map((t) => (
              <button key={t.id} className="plan-chip" onClick={() => onLoadTemplate(t)}>
                <DumbbellIcon size={14} /> {t.name}
                <span
                  className="plan-chip-delete"
                  role="button"
                  aria-label={`Delete ${t.name} plan`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete the "${t.name}" plan?`)) onDeleteTemplate(t.id);
                  }}
                >
                  <XIcon size={14} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <RestTimer />
      <WorkoutForm
        key={seedKey}
        initialDate={todayISO()}
        initialExercises={seedExercises ?? [emptyExercise()]}
        submitLabel={togetherMode ? "LOG BOTH WORKOUTS" : "LOG WORKOUT"}
        savingLabel="SAVING..."
        saving={saving}
        onRegisterExercise={onRegisterExercise}
        groups={groups}
        toCategory={toCategory}
        lastPerformance={lastPerformance}
        togetherMode={togetherMode}
        currentUser={user}
        otherUser={otherUser}
        lastPerformanceOther={lastPerformanceOther}
        onSubmit={({ date, exercises, exercisesOther, notes }) => {
          const workout: Workout = {
            id: uid(),
            user,
            date,
            exercises,
            notes,
            loggedAt: new Date().toISOString(),
          };
          if (togetherMode && exercisesOther) {
            const workoutOther: Workout = {
              id: uid(),
              user: otherUser,
              date,
              exercises: exercisesOther,
              notes,
              loggedAt: new Date().toISOString(),
            };
            return onSaveBoth(workout, workoutOther);
          }
          return onSave(workout);
        }}
      />
    </>
  );
}

function HistoryView({
  workouts,
  currentUser,
  onDelete,
  onEdit,
  onRegisterExercise,
  onRepeat,
  onSaveAsPlan,
  groups,
  toCategory,
  lastPerformance,
  editingId,
  setEditingId,
  savingEdit,
}: {
  workouts: Workout[];
  currentUser: WorkoutUser;
  onDelete: (id: string) => void;
  onEdit: (
    id: string,
    data: { date: string; exercises: Workout["exercises"]; notes: string },
  ) => Promise<boolean>;
  onRegisterExercise: (name: string, category: string) => void;
  onRepeat: (workout: Workout) => void;
  onSaveAsPlan: (workout: Workout) => void;
  groups: ExerciseGroup[];
  toCategory: Record<string, CategoryInfo>;
  lastPerformance: Record<string, Workout["exercises"][number]>;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  savingEdit: boolean;
}) {
  const [filter, setFilter] = useState<"all" | WorkoutUser>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return workouts;
    return workouts.filter((w) => w.user === filter);
  }, [workouts, filter]);

  if (!workouts.length) {
    return (
      <div className="view">
        <div className="empty-state">
          <Plate size={54} label="?" color="#6b7280" />
          <p>No workouts logged yet.</p>
          <p className="empty-sub">Log your first one to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="filter-row">
        {(["all", ...USERS] as const).map((f) => {
          const active = filter === f;
          const chipColor = f === "all" ? "#0b2545" : USER_COLORS[f];
          return (
            <button
              key={f}
              className={`filter-chip ${active ? "filter-chip--active" : ""}`}
              style={active ? { background: chipColor, borderColor: chipColor } : {}}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Everyone" : f}
            </button>
          );
        })}
      </div>

      <div className="history-list">
        {filtered.map((w) => {
          const totalSets = w.exercises.reduce((n, ex) => n + ex.sets.length, 0);
          const totalVolume = w.exercises.reduce(
            (n, ex) => n + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0),
            0,
          );
          const open = openId === w.id;
          const userColor = USER_COLORS[w.user];
          return (
            <div className="history-card" key={w.id}>
              <button
                className="history-summary"
                onClick={() => {
                  setOpenId(open ? null : w.id);
                  if (open) setEditingId(null);
                }}
              >
                <div className="history-summary-left">
                  <Plate size={38} label={w.user[0]} color={userColor} />
                  <div>
                    <div className="history-date">{formatDate(w.date)}</div>
                    <div className="history-meta">
                      {w.user} · {w.exercises.length} exercises · {totalSets} sets
                    </div>
                  </div>
                </div>
                <div className="history-summary-right">
                  <div className="history-volume">
                    {totalVolume.toLocaleString()}
                    <span>lbs moved</span>
                  </div>
                  {open ? (
                    <ChevronUpIcon size={20} color="#5b5d52" />
                  ) : (
                    <ChevronDownIcon size={20} color="#5b5d52" />
                  )}
                </div>
              </button>

              {open && editingId === w.id && (
                <div className="history-detail history-edit-wrap">
                  <WorkoutForm
                    initialDate={w.date}
                    initialExercises={workoutExercisesToDraft(w.exercises, toCategory)}
                    submitLabel="SAVE CHANGES"
                    savingLabel="SAVING..."
                    saving={savingEdit}
                    onCancel={() => setEditingId(null)}
                    onRegisterExercise={onRegisterExercise}
                    groups={groups}
                    toCategory={toCategory}
                    lastPerformance={lastPerformance}
                    currentUser={w.user}
                    otherUser={USERS.find((u) => u !== w.user) ?? w.user}
                    onSubmit={async (data) => {
                      const ok = await onEdit(w.id, data);
                      if (ok) setEditingId(null);
                      return ok;
                    }}
                  />
                </div>
              )}

              {open && editingId !== w.id && (
                <div className="history-detail">
                  {w.exercises.map((ex, i) => {
                    const cat = toCategory[ex.name] || OTHER_CATEGORY;
                    const isCardio =
                      cat.label === CARDIO_LABEL || ex.sets.some((s) => s.time || s.intensity);
                    return (
                      <div className="history-exercise" key={i}>
                        <div className="history-exercise-name">
                          <span className="history-dot" style={{ background: cat.color }} />
                          {ex.name}
                        </div>
                        <div className="history-sets">
                          {ex.sets.map((s, j) => (
                            <div className="history-set-line" key={j}>
                              {isCardio
                                ? `${s.time} min · Intensity ${s.intensity}/10`
                                : `${s.reps} reps × ${s.weight} lbs`}
                            </div>
                          ))}
                        </div>
                        {ex.notes && <p className="history-exercise-notes">"{ex.notes}"</p>}
                      </div>
                    );
                  })}
                  <div className="history-actions">
                    <button className="edit-btn" onClick={() => onRepeat(w)}>
                      <HistoryIcon size={16} /> Repeat
                    </button>
                    <button className="edit-btn" onClick={() => onSaveAsPlan(w)}>
                      <PlusIcon size={16} /> Save as Plan
                    </button>
                    {w.user === currentUser && (
                      <>
                        <button className="edit-btn" onClick={() => setEditingId(w.id)}>
                          <EditIcon size={16} /> Edit
                        </button>
                        <button className="delete-btn" onClick={() => onDelete(w.id)}>
                          <TrashIcon size={16} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsView({
  workouts,
  weighIns,
  toCategory,
}: {
  workouts: Workout[];
  weighIns: WeighIn[];
  toCategory: Record<string, CategoryInfo>;
}) {
  const [expandedUser, setExpandedUser] = useState<WorkoutUser | null>(USERS[0]);

  const weightStats = useMemo(() => {
    const byUser: Record<WorkoutUser, { date: string; total: number }[]> = {
      Diego: [],
      Kevin: [],
    };
    USERS.forEach((u) => {
      byUser[u] = weighIns
        .filter((w) => w.user === u)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((w) => ({ date: w.date, total: w.weight }));
    });
    const lossByUser: Record<WorkoutUser, number | null> = { Diego: null, Kevin: null };
    USERS.forEach((u) => {
      const series = byUser[u];
      if (series.length >= 2) {
        lossByUser[u] = series[0].total - series[series.length - 1].total;
      }
    });
    return { byUser, lossByUser };
  }, [weighIns]);

  const stats = useMemo(() => {
    const perUser: Record<WorkoutUser, { count: number; volume: number }> = {
      Diego: { count: 0, volume: 0 },
      Kevin: { count: 0, volume: 0 },
    };

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let thisWeek = 0;
    const prsByUser: Record<
      WorkoutUser,
      Record<string, { name: string; weight: number; reps: number; date: string }>
    > = { Diego: {}, Kevin: {} };
    const volumeByDate: Record<string, number> = {};

    workouts.forEach((w) => {
      if (perUser[w.user]) perUser[w.user].count += 1;
      if (new Date(w.date) >= weekAgo) thisWeek += 1;

      let dayTotal = 0;
      w.exercises.forEach((ex) => {
        const key = ex.name.trim().toLowerCase();
        ex.sets.forEach((s) => {
          const vol = s.reps * s.weight;
          if (perUser[w.user]) perUser[w.user].volume += vol;
          dayTotal += vol;
          const userPrs = prsByUser[w.user];
          if (userPrs && (!userPrs[key] || s.weight > userPrs[key].weight)) {
            userPrs[key] = { name: ex.name, weight: s.weight, reps: s.reps, date: w.date };
          }
        });
      });
      volumeByDate[w.date] = (volumeByDate[w.date] || 0) + dayTotal;
    });

    const prsFor = (u: WorkoutUser) =>
      Object.values(prsByUser[u] || {})
        .filter((p) => p.weight > 0)
        .sort((a, b) => b.weight - a.weight);

    const volumeSeries = Object.entries(volumeByDate)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { perUser, thisWeek, prsFor, total: workouts.length, volumeSeries };
  }, [workouts]);

  if (!workouts.length) {
    return (
      <div className="view">
        <div className="empty-state">
          <Plate size={54} label="0" color="#6b7280" />
          <p>No data yet.</p>
          <p className="empty-sub">Stats show up once you start logging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="hero-stat-card">
        <div className="hero-stat-dots" />
        <div className="hero-stat-number">{stats.total}</div>
        <div className="hero-stat-label">TOTAL WORKOUTS LOGGED</div>
      </div>

      <div className="tile-grid">
        <div className="tile" style={{ background: hexToRgba("#c9a227", 0.5) }}>
          <div className="tile-number">{stats.thisWeek}</div>
          <div className="tile-label">Last 7 Days</div>
        </div>
        {USERS.map((u) => (
          <div
            key={u}
            className="tile"
            style={{
              background: hexToRgba(USER_COLORS[u], 0.12),
              color: USER_COLORS[u],
            }}
          >
            <div className="tile-number">{stats.perUser[u].count}</div>
            <div className="tile-label">{u}'s Sessions</div>
          </div>
        ))}
      </div>

      <h3 className="section-heading">Progress</h3>
      {stats.volumeSeries.length >= 2 ? (
        <div className="weight-chart-card">
          <div className="progress-chart-label">Total Weight Lifted</div>
          <VolumeChart points={stats.volumeSeries} color="#c9a227" />
        </div>
      ) : (
        <div className="empty-state empty-state--compact">
          <p className="empty-sub">Log a couple more workouts to see your trend.</p>
        </div>
      )}

      {USERS.map((u) => {
        const series = weightStats.byUser[u];
        const loss = weightStats.lossByUser[u];
        if (!series.length) return null;
        return (
          <div className="weight-chart-card" key={u}>
            <div className="progress-chart-label progress-chart-label--row">
              <span>
                <span className="progress-dot" style={{ background: USER_COLORS[u] }} />
                {u}'s Weight Loss
              </span>
              {loss !== null && (
                <span
                  className={`weight-delta weight-delta--inline ${loss >= 0 ? "weight-delta--down" : "weight-delta--up"}`}
                >
                  {loss > 0 ? "−" : loss < 0 ? "+" : ""}
                  {Math.abs(loss).toFixed(1)} lbs {loss >= 0 ? "lost" : "gained"}
                </span>
              )}
            </div>
            {series.length >= 2 ? (
              <VolumeChart points={series} color={USER_COLORS[u]} />
            ) : (
              <p className="empty-sub">Log another weigh-in to see the trend.</p>
            )}
          </div>
        );
      })}

      <h3 className="section-heading">Personal Records</h3>
      {USERS.map((u) => {
        const list = stats.prsFor(u);
        const open = expandedUser === u;
        return (
          <div className="pr-accordion" key={u}>
            <button
              className="pr-accordion-header"
              onClick={() => setExpandedUser(open ? null : u)}
            >
              <div className="pr-accordion-left">
                <Plate size={32} label={u[0]} color={USER_COLORS[u]} />
                <span>{u}'s Personal Records</span>
                <span className="pr-count-badge">{list.length}</span>
              </div>
              {open ? (
                <ChevronUpIcon size={18} color="#5b5d52" />
              ) : (
                <ChevronDownIcon size={18} color="#5b5d52" />
              )}
            </button>
            {open && (
              <div className="pr-list">
                {list.length === 0 ? (
                  <p className="empty-sub pr-empty">No records yet.</p>
                ) : (
                  list.map((pr, i) => {
                    const cat = toCategory[pr.name] || OTHER_CATEGORY;
                    return (
                      <div className="pr-row" key={i}>
                        <div className="pr-info">
                          <div className="pr-name">{pr.name}</div>
                          <div className="pr-meta">
                            <span className="pr-dot" style={{ background: cat.color }} />
                            {formatDate(pr.date)}
                          </div>
                        </div>
                        <div className="pr-weight">
                          {pr.weight}
                          <span>lbs</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VolumeChart({
  points,
  color,
}: {
  points: { date: string; total: number }[];
  color: string;
}) {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map((p) => p.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 40;
  const stepX = w / (sorted.length - 1);
  const coords = sorted.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p.total - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="weight-chart" preserveAspectRatio="none">
      <polyline points={coords.join(" ")} fill="none" stroke={color} strokeWidth={2} />
      {sorted.map((p, i) => {
        const [x, y] = coords[i].split(",");
        return <circle key={p.date} cx={x} cy={y} r={2.2} fill={color} />;
      })}
    </svg>
  );
}

function WeightChart({ points, color }: { points: WeighIn[]; color: string }) {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const w = 100;
  const h = 40;
  const stepX = w / (sorted.length - 1);
  const coords = sorted.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p.weight - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="weight-chart" preserveAspectRatio="none">
      <polyline points={coords.join(" ")} fill="none" stroke={color} strokeWidth={2} />
      {sorted.map((p, i) => {
        const [x, y] = coords[i].split(",");
        return <circle key={p.id} cx={x} cy={y} r={2.2} fill={color} />;
      })}
    </svg>
  );
}

function WeightView({
  weighIns,
  user,
  onSave,
  onDelete,
  saving,
}: {
  weighIns: WeighIn[];
  user: WorkoutUser;
  onSave: (entry: WeighIn) => Promise<boolean>;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState("");
  const [expandedUser, setExpandedUser] = useState<WorkoutUser | null>(user);

  const mine = useMemo(
    () => weighIns.filter((w) => w.user === user).sort((a, b) => b.date.localeCompare(a.date)),
    [weighIns, user],
  );
  const chartData = useMemo(() => weighIns.filter((w) => w.user === user), [weighIns, user]);
  const byUser = useMemo(() => {
    const map: Record<WorkoutUser, WeighIn[]> = { Diego: [], Kevin: [] };
    USERS.forEach((u) => {
      map[u] = weighIns.filter((w) => w.user === u).sort((a, b) => b.date.localeCompare(a.date));
    });
    return map;
  }, [weighIns]);

  const latest = mine[0];
  const previous = mine[1];
  const delta = latest && previous ? latest.weight - previous.weight : null;

  const handleSave = async () => {
    const num = Number(weight);
    if (!weight || Number.isNaN(num) || num <= 0) return;
    const ok = await onSave({
      id: uid(),
      user,
      date,
      weight: num,
      loggedAt: new Date().toISOString(),
    });
    if (ok) {
      setWeight("");
      setDate(todayISO());
    }
  };

  return (
    <div className="view">
      <div className="hero-stat-card">
        <div className="hero-stat-dots" />
        <div className="hero-stat-number">
          {latest ? latest.weight : "—"}
          {latest && <span className="hero-stat-unit">lbs</span>}
        </div>
        <div className="hero-stat-label">
          {latest ? `LATEST · ${formatDate(latest.date)}` : "NO WEIGH-INS YET"}
        </div>
        {delta !== null && (
          <div className={`weight-delta ${delta <= 0 ? "weight-delta--down" : "weight-delta--up"}`}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} lbs since last
          </div>
        )}
      </div>

      {chartData.length >= 2 && (
        <div className="weight-chart-card">
          <WeightChart points={chartData} color={USER_COLORS[user]} />
        </div>
      )}

      <div className="log-date-row">
        <label className="field-label" htmlFor="weight-date">
          DATE
        </label>
        <input
          id="weight-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="weight-input-row">
        <label className="field-label" htmlFor="weight-value">
          WEIGHT (LBS)
        </label>
        <input
          id="weight-value"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          placeholder="0.0"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>

      <button className="save-btn" onClick={handleSave} disabled={!weight || saving}>
        {saving ? "SAVING..." : "LOG WEIGHT"}
      </button>

      <h3 className="section-heading weight-history-heading">History</h3>
      {USERS.map((u) => {
        const list = byUser[u];
        const open = expandedUser === u;
        return (
          <div className="pr-accordion" key={u}>
            <button
              className="pr-accordion-header"
              onClick={() => setExpandedUser(open ? null : u)}
            >
              <div className="pr-accordion-left">
                <Plate size={32} label={u[0]} color={USER_COLORS[u]} />
                <span>{u}'s Weigh-Ins</span>
                <span className="pr-count-badge">{list.length}</span>
              </div>
              {open ? (
                <ChevronUpIcon size={18} color="#5b5d52" />
              ) : (
                <ChevronDownIcon size={18} color="#5b5d52" />
              )}
            </button>
            {open && (
              <div className="weight-list weight-list--accordion">
                {list.length === 0 ? (
                  <p className="empty-sub pr-empty">No weigh-ins logged yet.</p>
                ) : (
                  list.map((w) => (
                    <div className="weight-row" key={w.id}>
                      <div className="weight-row-info">
                        <div className="weight-row-value">{w.weight} lbs</div>
                        <div className="weight-row-meta">{formatDate(w.date)}</div>
                      </div>
                      {w.user === user && (
                        <button className="weight-row-delete" onClick={() => onDelete(w.id)}>
                          <TrashIcon size={16} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const NAV_ITEMS = [
  { key: "log", label: "Log", Icon: DumbbellIcon },
  { key: "history", label: "History", Icon: HistoryIcon },
  { key: "weight", label: "Weight", Icon: ScaleIcon },
  { key: "stats", label: "Stats", Icon: BarChartIcon },
] as const;

function Index() {
  const {
    workouts: initialWorkouts,
    weighIns: initialWeighIns,
    customExercises: initialCustomExercises,
    templates: initialTemplates,
  } = Route.useLoaderData();
  const [user, setUser] = useState<WorkoutUser | null>(null);
  const [view, setView] = useState<"log" | "history" | "weight" | "stats">("log");
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [weighIns, setWeighIns] = useState<WeighIn[]>(initialWeighIns);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>(initialCustomExercises);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(initialTemplates);
  const [logSeed, setLogSeed] = useState<DraftExercise[] | null>(null);
  const [logSeedKey, setLogSeedKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingWeight, setSavingWeight] = useState(false);
  const [togetherMode, setTogetherMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherUser: WorkoutUser | null = user ? (USERS.find((u) => u !== user) ?? null) : null;

  const { groups, toCategory } = useMemo(
    () => mergeExerciseGroups(customExercises),
    [customExercises],
  );

  function registerExercise(name: string, category: string) {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const alreadyKnown = Object.keys(toCategory).some(
      (known) => known.toLowerCase() === trimmed.toLowerCase(),
    );
    if (alreadyKnown) return;
    setCustomExercises((prev) => [...prev, { name: trimmed, category }]);
    addCustomExercise({ data: { name: trimmed, category, createdBy: user } }).catch(() => {
      // Non-critical: the exercise still saved on this workout, it just
      // won't be remembered for next time if this silently failed.
    });
  }

  function computeLastPerformance(forUser: WorkoutUser | null) {
    const map: Record<string, Workout["exercises"][number]> = {};
    if (!forUser) return map;
    const theirs = [...workouts]
      .filter((w) => w.user === forUser)
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          (b.loggedAt || "").localeCompare(a.loggedAt || ""),
      );
    for (const w of theirs) {
      for (const ex of w.exercises) {
        if (!(ex.name in map)) map[ex.name] = ex;
      }
    }
    return map;
  }

  const lastPerformanceForUser = useMemo(() => computeLastPerformance(user), [workouts, user]);
  const lastPerformanceForOtherUser = useMemo(
    () => computeLastPerformance(otherUser),
    [workouts, otherUser],
  );

  function loadIntoLog(exercises: DraftExercise[]) {
    setLogSeed(exercises);
    setLogSeedKey((k) => k + 1);
    setView("log");
  }

  function loadTemplate(template: WorkoutTemplate) {
    loadIntoLog(templateToDraft(template.exercises, toCategory));
  }

  function repeatWorkout(workout: Workout) {
    loadIntoLog(blankDraftSets(workoutExercisesToDraft(workout.exercises, toCategory)));
  }

  async function saveAsPlan(workout: Workout) {
    if (!user) return;
    const name = window.prompt(
      "Name this plan:",
      `${workout.user}'s ${formatDate(workout.date)} workout`,
    );
    if (!name || !name.trim()) return;
    const id = uid();
    const exercises: TemplateExercise[] = workout.exercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets.length,
    }));
    const template: WorkoutTemplate = { id, name: name.trim(), createdBy: user, exercises };
    setTemplates((prev) => [...prev, template].sort((a, b) => a.name.localeCompare(b.name)));
    try {
      await createTemplate({ data: { id, name: template.name, exercises, createdBy: user } });
    } catch {
      setError("Couldn't save that plan — check your connection and try again.");
    }
  }

  async function removeTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTemplate({ data: { id } });
    } catch {
      setError("Couldn't delete that plan — check your connection and try again.");
    }
  }

  async function addWorkout(workout: Workout) {
    setSaving(true);
    setError(null);
    try {
      await createWorkout({ data: workout });
      setWorkouts((prev) => [workout, ...prev]);
      return true;
    } catch {
      setError("Couldn't save that — check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addWorkoutForBoth(workout: Workout, workoutOther: Workout) {
    setSaving(true);
    setError(null);
    try {
      await Promise.all([createWorkout({ data: workout }), createWorkout({ data: workoutOther })]);
      setWorkouts((prev) => [workout, workoutOther, ...prev]);
      return true;
    } catch {
      setError("Couldn't save that — check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function editWorkout(
    id: string,
    data: { date: string; exercises: Workout["exercises"]; notes: string },
  ) {
    if (!user) return false;
    setSavingEdit(true);
    setError(null);
    try {
      await updateWorkout({ data: { id, user, ...data } });
      setWorkouts((prev) => prev.map((w) => (w.id === id ? { ...w, ...data } : w)));
      return true;
    } catch {
      setError("Couldn't save those changes — check your connection and try again.");
      return false;
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeWorkout(id: string) {
    if (!user) return;
    setError(null);
    try {
      await deleteWorkout({ data: { id, user } });
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
    } catch {
      setError("Couldn't delete that — check your connection and try again.");
    }
  }

  async function addWeighIn(entry: WeighIn) {
    setSavingWeight(true);
    setError(null);
    try {
      await createWeighIn({ data: entry });
      setWeighIns((prev) => [entry, ...prev]);
      return true;
    } catch {
      setError("Couldn't save that — check your connection and try again.");
      return false;
    } finally {
      setSavingWeight(false);
    }
  }

  async function removeWeighIn(id: string) {
    if (!user) return;
    setError(null);
    try {
      await deleteWeighIn({ data: { id, user } });
      setWeighIns((prev) => prev.filter((w) => w.id !== id));
    } catch {
      setError("Couldn't delete that — check your connection and try again.");
    }
  }

  const sorted = useMemo(
    () =>
      [...workouts].sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          (b.loggedAt || "").localeCompare(a.loggedAt || ""),
      ),
    [workouts],
  );

  const userColor = user ? USER_COLORS[user] : "#0b2545";

  return (
    <div className="app-root">
      {!user ? (
        <ProfileSelect onSelect={setUser} />
      ) : (
        <>
          <div className="top-bar">
            <div className="top-wordmark">
              FLEX<span>DADDIES</span>
            </div>
            <button className="switch-user" onClick={() => setUser(null)}>
              <Plate size={26} label={user[0]} color={userColor} /> <UserIcon size={16} /> Switch
            </button>
          </div>

          <div className="content-wrap">
            {error && <div className="error-banner">{error}</div>}

            {view === "log" && otherUser && (
              <LogView
                user={user}
                otherUser={otherUser}
                onSave={addWorkout}
                onSaveBoth={addWorkoutForBoth}
                onRegisterExercise={registerExercise}
                groups={groups}
                toCategory={toCategory}
                saving={saving}
                templates={templates}
                onLoadTemplate={loadTemplate}
                onDeleteTemplate={removeTemplate}
                seedExercises={logSeed}
                seedKey={logSeedKey}
                lastPerformance={lastPerformanceForUser}
                lastPerformanceOther={lastPerformanceForOtherUser}
                togetherMode={togetherMode}
                setTogetherMode={setTogetherMode}
              />
            )}
            {view === "history" && (
              <HistoryView
                workouts={sorted}
                currentUser={user}
                onDelete={removeWorkout}
                onEdit={editWorkout}
                onRegisterExercise={registerExercise}
                onRepeat={repeatWorkout}
                onSaveAsPlan={saveAsPlan}
                groups={groups}
                toCategory={toCategory}
                lastPerformance={lastPerformanceForUser}
                editingId={editingId}
                setEditingId={setEditingId}
                savingEdit={savingEdit}
              />
            )}
            {view === "weight" && (
              <WeightView
                weighIns={weighIns}
                user={user}
                onSave={addWeighIn}
                onDelete={removeWeighIn}
                saving={savingWeight}
              />
            )}
            {view === "stats" && (
              <StatsView workouts={workouts} weighIns={weighIns} toCategory={toCategory} />
            )}
          </div>

          <div className="bottom-nav-wrap">
            <div className="bottom-nav">
              {NAV_ITEMS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className={`bottom-nav-btn ${view === key ? "bottom-nav-btn--active" : ""}`}
                  onClick={() => setView(key)}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
