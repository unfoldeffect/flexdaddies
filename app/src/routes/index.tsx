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
import {
  createWeighIn,
  deleteWeighIn,
  listWeighIns,
  type WeighIn,
} from "../lib/api/weigh-ins.functions";
import {
  createWorkout,
  deleteWorkout,
  listWorkouts,
  updateWorkout,
  type Workout,
} from "../lib/api/workouts.functions";
import {
  EXERCISE_GROUPS,
  EXERCISE_TO_CATEGORY,
  NUM_SETS,
  OTHER_CATEGORY,
  OTHER_VALUE,
  USERS,
  USER_COLORS,
  formatDate,
  hexToRgba,
  todayISO,
  uid,
  type WorkoutUser,
} from "../lib/workout-data";

export const Route = createFileRoute("/")({
  loader: async () => ({
    workouts: await listWorkouts(),
    weighIns: await listWeighIns(),
  }),
  component: Index,
});

type DraftSet = { id: string; reps: string; weight: string };
type DraftExercise = { id: string; name: string; customName: string; sets: DraftSet[] };

function makeSets(): DraftSet[] {
  return Array.from({ length: NUM_SETS }, () => ({ id: uid(), reps: "", weight: "" }));
}

function emptyExercise(): DraftExercise {
  return { id: uid(), name: "", customName: "", sets: makeSets() };
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
}: {
  exercise: DraftExercise;
  onChange: (updated: DraftExercise) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const updateSet = (setId: string, field: "reps" | "weight", value: string) => {
    onChange({
      ...exercise,
      sets: exercise.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
    });
  };

  const isOther = exercise.name === OTHER_VALUE;
  const category = exercise.name
    ? isOther
      ? OTHER_CATEGORY
      : EXERCISE_TO_CATEGORY[exercise.name] || OTHER_CATEGORY
    : null;
  const accent = category ? category.color : "#dbe0d6";

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
            onChange={(e) => onChange({ ...exercise, name: e.target.value })}
          >
            <option value="" disabled>
              Choose an exercise
            </option>
            {EXERCISE_GROUPS.map((g) => (
              <optgroup label={g.label} key={g.label}>
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
            <input
              className="exercise-custom-input"
              type="text"
              placeholder="Type exercise name"
              value={exercise.customName}
              onChange={(e) => onChange({ ...exercise, customName: e.target.value })}
            />
          )}
        </div>
        {showRemove && (
          <button className="icon-btn" onClick={onRemove} aria-label="Remove exercise">
            <XIcon size={20} />
          </button>
        )}
      </div>

      <div className="set-rows">
        <div className="set-row set-row--header">
          <span>SET</span>
          <span>REPS</span>
          <span>WEIGHT (LBS)</span>
        </div>
        {exercise.sets.map((s, i) => (
          <div className="set-row" key={s.id}>
            <span className="set-index" style={{ background: accent }}>
              {i + 1}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={s.reps}
              onChange={(e) => updateSet(s.id, "reps", e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={s.weight}
              onChange={(e) => updateSet(s.id, "weight", e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function workoutExercisesToDraft(exercises: Workout["exercises"]): DraftExercise[] {
  if (!exercises.length) return [emptyExercise()];
  return exercises.map((ex) => {
    const known = !!EXERCISE_TO_CATEGORY[ex.name];
    const sets: DraftSet[] = ex.sets.map((s) => ({
      id: uid(),
      reps: String(s.reps),
      weight: String(s.weight),
    }));
    while (sets.length < NUM_SETS) sets.push({ id: uid(), reps: "", weight: "" });
    return {
      id: uid(),
      name: known ? ex.name : OTHER_VALUE,
      customName: known ? "" : ex.name,
      sets,
    };
  });
}

function WorkoutForm({
  initialDate,
  initialExercises,
  initialNotes,
  submitLabel,
  savingLabel,
  onSubmit,
  onCancel,
  saving,
}: {
  initialDate: string;
  initialExercises: DraftExercise[];
  initialNotes: string;
  submitLabel: string;
  savingLabel: string;
  onSubmit: (data: { date: string; exercises: Workout["exercises"]; notes: string }) => Promise<boolean>;
  onCancel?: () => void;
  saving: boolean;
}) {
  const [date, setDate] = useState(initialDate);
  const [exercises, setExercises] = useState<DraftExercise[]>(initialExercises);
  const [notes, setNotes] = useState(initialNotes);
  const [justSaved, setJustSaved] = useState(false);

  const updateExercise = (id: string, updated: DraftExercise) =>
    setExercises((prev) => prev.map((ex) => (ex.id === id ? updated : ex)));
  const removeExercise = (id: string) => setExercises((prev) => prev.filter((ex) => ex.id !== id));
  const addExercise = () => setExercises((prev) => [...prev, emptyExercise()]);

  const finalName = (ex: DraftExercise) => (ex.name === OTHER_VALUE ? ex.customName.trim() : ex.name);

  const canSave = exercises.some(
    (ex) => finalName(ex) && ex.sets.some((s) => s.reps || s.weight),
  );

  const handleSave = async () => {
    const cleaned = exercises
      .filter((ex) => finalName(ex))
      .map((ex) => ({
        name: finalName(ex),
        sets: ex.sets
          .filter((s) => s.reps !== "" || s.weight !== "")
          .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 })),
      }))
      .filter((ex) => ex.sets.length);

    if (!cleaned.length) return;

    const ok = await onSubmit({ date, exercises: cleaned, notes: notes.trim() });
    if (ok && !onCancel) {
      setExercises([emptyExercise()]);
      setNotes("");
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
        />
      ))}

      <button className="add-exercise-btn" onClick={addExercise}>
        <PlusIcon size={20} /> Add Another Exercise
      </button>

      <div className="notes-block">
        <label className="field-label" htmlFor="notes">
          NOTES <span className="field-label-sub">(optional)</span>
        </label>
        <textarea
          id="notes"
          placeholder="How did it feel today?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

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
  onSave,
  saving,
}: {
  user: WorkoutUser;
  onSave: (workout: Workout) => Promise<boolean>;
  saving: boolean;
}) {
  return (
    <WorkoutForm
      initialDate={todayISO()}
      initialExercises={[emptyExercise()]}
      initialNotes=""
      submitLabel="LOG WORKOUT"
      savingLabel="SAVING..."
      saving={saving}
      onSubmit={({ date, exercises, notes }) =>
        onSave({
          id: uid(),
          user,
          date,
          exercises,
          notes,
          loggedAt: new Date().toISOString(),
        })
      }
    />
  );
}

function HistoryView({
  workouts,
  currentUser,
  onDelete,
  onEdit,
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
                    initialExercises={workoutExercisesToDraft(w.exercises)}
                    initialNotes={w.notes}
                    submitLabel="SAVE CHANGES"
                    savingLabel="SAVING..."
                    saving={savingEdit}
                    onCancel={() => setEditingId(null)}
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
                    const cat = EXERCISE_TO_CATEGORY[ex.name] || OTHER_CATEGORY;
                    return (
                      <div className="history-exercise" key={i}>
                        <div className="history-exercise-name">
                          <span className="history-dot" style={{ background: cat.color }} />
                          {ex.name}
                        </div>
                        <div className="history-sets">
                          {ex.sets.map((s, j) => (
                            <span className="history-set-pill" key={j}>
                              {s.reps} reps × {s.weight} lbs
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {w.notes && <p className="history-notes">"{w.notes}"</p>}
                  {w.user === currentUser && (
                    <div className="history-actions">
                      <button className="edit-btn" onClick={() => setEditingId(w.id)}>
                        <EditIcon size={16} /> Edit
                      </button>
                      <button className="delete-btn" onClick={() => onDelete(w.id)}>
                        <TrashIcon size={16} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsView({ workouts }: { workouts: Workout[] }) {
  const stats = useMemo(() => {
    const perUser: Record<WorkoutUser, { count: number; volume: number }> = {
      Diego: { count: 0, volume: 0 },
      Kevin: { count: 0, volume: 0 },
    };

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let thisWeek = 0;
    const prs: Record<
      string,
      { name: string; weight: number; reps: number; user: WorkoutUser; date: string }
    > = {};

    workouts.forEach((w) => {
      if (perUser[w.user]) perUser[w.user].count += 1;
      if (new Date(w.date) >= weekAgo) thisWeek += 1;

      w.exercises.forEach((ex) => {
        const key = ex.name.trim().toLowerCase();
        ex.sets.forEach((s) => {
          if (perUser[w.user]) perUser[w.user].volume += s.reps * s.weight;
          if (!prs[key] || s.weight > prs[key].weight) {
            prs[key] = { name: ex.name, weight: s.weight, reps: s.reps, user: w.user, date: w.date };
          }
        });
      });
    });

    const prList = Object.values(prs)
      .filter((p) => p.weight > 0)
      .sort((a, b) => b.weight - a.weight);

    return { perUser, thisWeek, prList, total: workouts.length };
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

      <h3 className="section-heading">Personal Records</h3>
      <div className="pr-list">
        {stats.prList.map((pr, i) => {
          const cat = EXERCISE_TO_CATEGORY[pr.name] || OTHER_CATEGORY;
          return (
            <div className="pr-row" key={i}>
              <Plate size={34} label={pr.user[0]} color={USER_COLORS[pr.user]} />
              <div className="pr-info">
                <div className="pr-name">{pr.name}</div>
                <div className="pr-meta">
                  <span className="pr-dot" style={{ background: cat.color }} />
                  {pr.user} · {formatDate(pr.date)}
                </div>
              </div>
              <div className="pr-weight">
                {pr.weight}
                <span>lbs</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
  const [filter, setFilter] = useState<"all" | WorkoutUser>("all");

  const mine = useMemo(
    () => weighIns.filter((w) => w.user === user).sort((a, b) => b.date.localeCompare(a.date)),
    [weighIns, user],
  );
  const chartData = useMemo(
    () => weighIns.filter((w) => w.user === user),
    [weighIns, user],
  );
  const filtered = useMemo(() => {
    const list = filter === "all" ? weighIns : weighIns.filter((w) => w.user === filter);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [weighIns, filter]);

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

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Plate size={54} label="?" color="#6b7280" />
          <p>No weigh-ins logged yet.</p>
        </div>
      ) : (
        <div className="weight-list">
          {filtered.map((w) => (
            <div className="weight-row" key={w.id}>
              <Plate size={32} label={w.user[0]} color={USER_COLORS[w.user]} />
              <div className="weight-row-info">
                <div className="weight-row-value">{w.weight} lbs</div>
                <div className="weight-row-meta">
                  {w.user} · {formatDate(w.date)}
                </div>
              </div>
              {w.user === user && (
                <button className="weight-row-delete" onClick={() => onDelete(w.id)}>
                  <TrashIcon size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
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
  const { workouts: initialWorkouts, weighIns: initialWeighIns } = Route.useLoaderData();
  const [user, setUser] = useState<WorkoutUser | null>(null);
  const [view, setView] = useState<"log" | "history" | "weight" | "stats">("log");
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [weighIns, setWeighIns] = useState<WeighIn[]>(initialWeighIns);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingWeight, setSavingWeight] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function editWorkout(
    id: string,
    data: { date: string; exercises: Workout["exercises"]; notes: string },
  ) {
    if (!user) return false;
    setSavingEdit(true);
    setError(null);
    try {
      await updateWorkout({ data: { id, user, ...data } });
      setWorkouts((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...data } : w)),
      );
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

            {view === "log" && <LogView user={user} onSave={addWorkout} saving={saving} />}
            {view === "history" && (
              <HistoryView
                workouts={sorted}
                currentUser={user}
                onDelete={removeWorkout}
                onEdit={editWorkout}
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
            {view === "stats" && <StatsView workouts={workouts} />}
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
