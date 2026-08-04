// SPEC.md section 7.3.
import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/useStore';
import { dayTitles, program } from '../data/program';
import { exerciseName } from '../data/exercises';
import { ladders } from '../data/ladders';
import { currentWeek, dayIdForDate, phaseForWeek } from '../domain/phase';
import { startOfToday, todayISO } from '../domain/clock';
import { SKILLS } from '../domain/analysis';
import {
  bestAsOf,
  bestByVariant,
  bestBySession,
  bestByWeek,
  bestOverall,
  formatBest,
  trend,
  trendArrow,
} from '../domain/performance';
import type { Best } from '../domain/performance';
import type { DayId, Exercise, SessionLog } from '../domain/types';
import ProgressChart from '../components/ProgressChart';
import { tooltipFormatter } from '../components/chartFormat';
import Sheet from '../components/Sheet';
import PhaseBadge from '../components/PhaseBadge';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';

const DAY_ORDER: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Grouped-by-day-and-block browse view, or a flat name search — no invented
 * muscle-group taxonomy, per SPEC-V1.1.md prompt 7. Built on the existing
 * Sheet component; day/block/order are all data that already exists on Exercise.
 */
function ExercisePickerSheet({
  open,
  onClose,
  exercises,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return exercises.filter((e) => e.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [query, exercises]);

  const groups = useMemo(() => {
    return DAY_ORDER.map((day) => ({
      day,
      label: dayTitles[day],
      main: exercises.filter((e) => e.day === day && e.block === 'main').sort((a, b) => a.order - b.order),
      am: exercises.filter((e) => e.day === day && e.block === 'am').sort((a, b) => a.order - b.order),
    })).filter((g) => g.main.length > 0 || g.am.length > 0);
  }, [exercises]);

  function pick(id: string) {
    onPick(id);
    setQuery('');
    onClose();
  }

  function ExerciseRow({ exercise, showDay }: { exercise: Exercise; showDay: boolean }) {
    return (
      <li>
        <button
          type="button"
          onClick={() => pick(exercise.id)}
          className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left text-sm text-text"
        >
          <span>{exercise.name}</span>
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted">
            {showDay ? `${dayTitles[exercise.day]} · ` : ''}
            {exercise.block}
          </span>
        </button>
      </li>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Choose exercise">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises…"
        autoFocus
        className="min-h-11 w-full rounded border border-line bg-surface-2 px-3 text-base text-text"
      />
      <div className="mt-3 max-h-[55vh] overflow-y-auto">
        {searchResults ? (
          searchResults.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">No exercises match — try a different search.</p>
          ) : (
            <ul className="divide-y divide-line">
              {searchResults.map((e) => (
                <ExerciseRow key={e.id} exercise={e} showDay />
              ))}
            </ul>
          )
        ) : (
          groups.map((g) => (
            <div key={g.day} className="mb-3">
              <div className="text-xs uppercase tracking-wide text-muted">{g.label}</div>
              {g.main.length > 0 && (
                <ul className="mt-1 divide-y divide-line">
                  {g.main.map((e) => (
                    <ExerciseRow key={e.id} exercise={e} showDay={false} />
                  ))}
                </ul>
              )}
              {g.am.length > 0 && (
                <ul className="mt-1 divide-y divide-line">
                  {g.am.map((e) => (
                    <ExerciseRow key={e.id} exercise={e} showDay={false} />
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </Sheet>
  );
}

function Sparkline({ weeks }: { weeks: (Best | null)[] }) {
  const values = weeks.map((b) => b?.value ?? null);
  const max = Math.max(...values.filter((v): v is number => v !== null), 0);
  if (max === 0) return <p className="mt-2 text-xs text-muted">No qualifying sets yet.</p>;

  return (
    <div className="mt-2 flex h-8 items-end gap-1" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          title={v !== null ? `Week ${i + 1}: ${formatBest(weeks[i])}` : `Week ${i + 1}: no data`}
          className="flex-1 rounded-sm"
          style={{
            height: v !== null ? `${Math.max(8, (v / max) * 100)}%` : '2px',
            backgroundColor: v !== null ? 'var(--good)' : 'var(--line)',
          }}
        />
      ))}
    </div>
  );
}

function amDayComplete(session: SessionLog | undefined, exercisesForDay: Exercise[]): boolean {
  if (!session) return false;
  const amExercises = exercisesForDay.filter((e) => e.block === 'am');
  if (amExercises.length === 0) return false;
  return amExercises.every((e) => session.exercises.some((log) => log.exerciseId === e.id && log.sets.length > 0));
}

export default function Progress() {
  const settings = useStore((s) => s.settings);
  const sessionLogs = useStore((s) => s.sessionLogs);
  const dailyEntries = useStore((s) => s.dailyEntries);
  const progressionEvents = useStore((s) => s.progressionEvents);

  const dailyEntriesArray = useMemo(() => Object.values(dailyEntries), [dailyEntries]);
  const todayStr = todayISO();

  // AM exercises are tracked as of v1.1 (SPEC-V1.1.md section 2), so the picker
  // now spans ~70 exercises rather than 27 -- ExercisePickerSheet groups by
  // day/block and supports search so it stays usable at that size.
  const trackedExercises = useMemo(() => program.filter((e) => e.tracked), []);
  const [selectedExerciseId, setSelectedExerciseId] = useState(
    trackedExercises.find((e) => e.block === 'main')?.id ?? trackedExercises[0]?.id ?? '',
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedExercise = trackedExercises.find((e) => e.id === selectedExerciseId) ?? trackedExercises[0];

  // --- Skill headlines ---
  // v3.0 (SPEC-V3.0.md section 2): the plain best in the movement's own unit,
  // a trend arrow, and the same figure four weeks ago. No index, no
  // unitless score. `variants` shows the best per variant/assistance group so
  // a rep PR at an easier variant is never read as beating a harder one.
  const skillHeadlines = useMemo(
    () =>
      SKILLS.map((skill) => {
        const exercise = program.find((e) => e.id === skill.exerciseId);
        if (!exercise) return null;
        const history = bestBySession(sessionLogs, exercise);
        const fourWeeksAgo = format(addDays(startOfToday(), -28), 'yyyy-MM-dd');
        const ladder = exercise.ladderId ? ladders.find((l) => l.id === exercise.ladderId) : undefined;
        const variantLabel = (best: Best | null) =>
          ladder && best?.variantId ? ladder.variants.find((v) => v.id === best.variantId)?.label : undefined;

        const current = bestOverall(history);
        return {
          skill,
          exercise,
          current,
          then: bestAsOf(history, fourWeeksAgo),
          trend: trend(history),
          variantLabel: variantLabel(current),
          weekly: bestByWeek(history),
          variants: Array.from(bestByVariant(history).entries()).map(([key, best]) => ({
            key,
            label: variantLabel(best) ?? 'no variant',
            tier: best.assistanceTier ?? 0,
            best,
          })),
        };
      }),
    [sessionLogs],
  );

  // --- Consistency heatmap ---
  const heatmap = useMemo(() => {
    const blockStart = parseISO(settings.blockStartDate);
    const weeks = Array.from({ length: 12 }, (_, i) => i + 1);
    return weeks.map((w) => {
      const days = Array.from({ length: 7 }, (_, d) => {
        const date = format(addDays(blockStart, (w - 1) * 7 + d), 'yyyy-MM-dd');
        const dayId = dayIdForDate(parseISO(date));
        const exercisesForDay = program.filter((e) => e.day === dayId);
        let count = 0;
        if (sessionLogs[`${date}:main`]?.completedAt) count++;
        if (amDayComplete(sessionLogs[`${date}:am`], exercisesForDay)) count++;
        return { date, count };
      });
      return { week: w, days };
    });
  }, [sessionLogs, settings.blockStartDate]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 84; i++) {
      const date = format(addDays(parseISO(todayStr), -i), 'yyyy-MM-dd');
      const hasAny = (sessionLogs[`${date}:main`]?.completedAt ? 1 : 0) + (() => {
        const dayId = dayIdForDate(parseISO(date));
        return amDayComplete(sessionLogs[`${date}:am`], program.filter((e) => e.day === dayId)) ? 1 : 0;
      })();
      if (hasAny > 0) count++;
      else if (i > 0) break;
      else continue; // today with nothing logged yet doesn't break the streak
    }
    return count;
  }, [sessionLogs, todayStr]);

  // --- Flag frequency ---
  const flagFrequency = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of Object.values(sessionLogs)) {
      for (const log of session.exercises) {
        for (const set of log.sets) {
          if (set.techniqueFlags.length === 0) continue;
          counts.set(log.exerciseId, (counts.get(log.exerciseId) ?? 0) + set.techniqueFlags.length);
        }
      }
    }
    return Array.from(counts.entries())
      .map(([exerciseId, count]) => ({
        exerciseId,
        name: exerciseName(exerciseId),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [sessionLogs]);

  const week = currentWeek(startOfToday(), settings.blockStartDate);

  return (
    <div className="flex h-full flex-col">
      <PhaseBadge week={week} phase={phaseForWeek(week)} dateLabel={format(startOfToday(), 'EEE d MMM')} />

      <div className="flex-1 overflow-y-auto p-4">
      <h1 className="font-display text-2xl text-text">Progress</h1>

      <section className="mt-4 grid grid-cols-1 gap-2">
        {skillHeadlines.map((h) => {
          if (!h) return null;
          return (
            <Card key={h.skill.id}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-muted">{h.skill.label}</span>
                <span className="text-xs text-muted">{h.variantLabel ?? '—'}</span>
              </div>

              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl tabular-nums text-text">{formatBest(h.current)}</span>
                <span
                  className={
                    h.trend === 'up' ? 'text-good' : h.trend === 'down' ? 'text-bad' : 'text-muted'
                  }
                >
                  {trendArrow(h.trend)}
                </span>
              </div>

              <div className="mt-1 text-xs text-muted">
                {h.then ? `was ${formatBest(h.then)} four weeks ago` : 'no comparison yet'}
              </div>

              <Sparkline weeks={h.weekly} />

              {h.variants.length > 1 && (
                <ul className="mt-2 space-y-0.5 border-t border-line pt-2 text-xs text-muted">
                  {h.variants.map((v) => (
                    <li key={v.key} className="flex justify-between gap-2">
                      <span>
                        {v.label}
                        {v.tier > 0 ? ` · tier ${v.tier}` : ''}
                      </span>
                      <span className="tabular-nums text-text">{formatBest(v.best)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </section>

      <Card className="mt-4">
        <label className="block text-sm">
          <span className="text-xs text-muted">Exercise</span>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-1 flex min-h-11 w-full items-center justify-between rounded border border-line bg-surface-2 px-3 text-left text-text"
          >
            <span>{selectedExercise?.name ?? 'Select exercise'}</span>
            {selectedExercise && (
              <span className="shrink-0 text-xs uppercase tracking-wide text-muted">
                {dayTitles[selectedExercise.day]} · {selectedExercise.block}
              </span>
            )}
          </button>
        </label>
        <ExercisePickerSheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          exercises={trackedExercises}
          onPick={setSelectedExerciseId}
        />
        {selectedExercise && (
          <div className="mt-3">
            <ProgressChart
              exercise={selectedExercise}
              sessionLogs={sessionLogs}
              dailyEntries={dailyEntriesArray}
              settings={settings}
            />
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <SectionHeader>Progression events</SectionHeader>
        <div className="mt-1">
          {progressionEvents.length === 0 ? (
            <p className="mt-1 text-xs text-muted">No progression events logged yet.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-xs text-text">
              {progressionEvents
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((event) => (
                  <li key={event.id}>
                    {event.date} · {exerciseName(event.exerciseId)} —{' '}
                    {event.axis}: {event.from} → {event.to}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="mt-4 overflow-x-auto">
        <div className="flex items-baseline justify-between">
          <SectionHeader>Consistency</SectionHeader>
          <span className="text-xs tabular-nums text-muted">{streak}-day streak</span>
        </div>
        <div className="mt-2 flex gap-1">
          {heatmap.map((col) => (
            <div key={col.week} className="flex flex-col gap-1">
              {col.days.map((d) => (
                <div
                  key={d.date}
                  title={d.date}
                  className="h-3 w-3 rounded-sm"
                  style={{
                    backgroundColor: d.count === 0 ? 'var(--line)' : 'var(--good)',
                    opacity: d.count === 0 ? 1 : d.count === 1 ? 0.5 : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1 text-[10px] text-muted">
          {heatmap.map((col) => (
            <div key={col.week} className="w-3 text-center">
              {col.week}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Flag frequency</SectionHeader>
        {flagFrequency.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No technique flags logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, flagFrequency.length * 28)}>
            <BarChart data={flagFrequency} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
                formatter={tooltipFormatter(0)}
              />
              <Bar dataKey="count" fill="var(--warn)" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
      </div>
    </div>
  );
}
