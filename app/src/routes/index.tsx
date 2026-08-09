import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  BarChartIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DumbbellIcon,
  HistoryIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  XIcon,
} from "../components/icons";
import { createWorkout, deleteWorkout, listWorkouts, type Workout } from "../lib/api/workouts.functions";
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
  loader: async () => ({ workouts: await listWorkouts() }),
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

function LogView({
  user,
  onSave,
  saving,
}: {
  user: WorkoutUser;
  onSave: (workout: Workout) => Promise<boolean>;
  saving: boolean;
}) {
  const [date, setDate] = useState(todayISO());
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()]);
  const [notes, setNotes] = useState("");
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

    const workout: Workout = {
      id: uid(),
      user,
      date,
      exercises: cleaned,
      notes: notes.trim(),
      loggedAt: new Date().toISOString(),
    };
    const ok = await onSave(workout);
    if (ok) {
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

      <button className="save-btn" onClick={handleSave} disabled={!canSave || saving}>
        {saving ? "SAVING..." : justSaved ? "SAVED ✓" : "LOG WORKOUT"}
      </button>
    </div>
  );
}

function HistoryView({
  workouts,
  currentUser,
  onDelete,
}: {
  workouts: Workout[];
  currentUser: WorkoutUser;
  onDelete: (id: string) => void;
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
              <button className="history-summary" onClick={() => setOpenId(open ? null : w.id)}>
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

              {open && (
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
                    <button className="delete-btn" onClick={() => onDelete(w.id)}>
                      <TrashIcon size={16} /> Delete this entry
                    </button>
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

const NAV_ITEMS = [
  { key: "log", label: "Log", Icon: DumbbellIcon },
  { key: "history", label: "History", Icon: HistoryIcon },
  { key: "stats", label: "Stats", Icon: BarChartIcon },
] as const;

function Index() {
  const { workouts: initialWorkouts } = Route.useLoaderData();
  const [user, setUser] = useState<WorkoutUser | null>(null);
  const [view, setView] = useState<"log" | "history" | "stats">("log");
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [saving, setSaving] = useState(false);
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
              <HistoryView workouts={sorted} currentUser={user} onDelete={removeWorkout} />
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
