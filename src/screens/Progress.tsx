// SPEC.md section 7.3.
import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/useStore';
import { dayTitles, program } from '../data/program';
import { ladders } from '../data/ladders';
import { currentWeek, dayIdForDate, phaseForWeek } from '../domain/phase';
import { startOfToday, todayISO } from '../domain/clock';
import { SKILLS } from '../domain/analysis';
import { rolling7Weight } from '../domain/body';
import { effectiveLevelForSet } from '../domain/difficulty';
import {
  buildExerciseHistory,
  computeSetScore,
  exerciseProgressIndex,
  exerciseRollingBestRaw,
  isQualifyingSet,
} from '../domain/scoring';
import type { DayId, Exercise, Ladder, SessionLog } from '../domain/types';
import ProgressChart from '../components/ProgressChart';
import Sheet from '../components/Sheet';
import PhaseBadge from '../components/PhaseBadge';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';

const SKILL_COLOR: Record<string, string> = {
  frontLever: 'var(--good)',
  hspu: 'var(--taper)',
  pistol: 'var(--intensification)',
  pullup: 'var(--peak)',
};

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

function ladderFor(exercise: Exercise | undefined): Ladder | undefined {
  return exercise?.ladderId ? ladders.find((l) => l.id === exercise.ladderId) : undefined;
}

function mostRecentQualifyingSet(sessionLogs: Record<string, SessionLog>, exerciseId: string) {
  const sessions = Object.values(sessionLogs)
    .filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const session of sessions) {
    const log = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!log) continue;
    for (let i = log.sets.length - 1; i >= 0; i--) {
      if (isQualifyingSet(log.sets[i])) return log.sets[i];
    }
  }
  return undefined;
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
  const selectedLadder = ladderFor(selectedExercise);

  function bodyweightAt(date: string): number {
    return rolling7Weight(dailyEntriesArray, date) ?? settings.startWeightKg;
  }

  // --- Skill headlines ---
  const skillHeadlines = useMemo(
    () =>
      SKILLS.map((skill) => {
        const exercise = program.find((e) => e.id === skill.exerciseId);
        if (!exercise) return null;
        const ladder = ladderFor(exercise);
        const history = buildExerciseHistory(sessionLogs, exercise.id, (set, date) =>
          computeSetScore(exercise, ladder, set, bodyweightAt(date)),
        );
        const progressIndex = exerciseProgressIndex(history);
        const fourWeeksAgo = format(addDays(startOfToday(), -28), 'yyyy-MM-dd');
        const progressIndex4wAgo = exerciseProgressIndex(history.filter((r) => r.date <= fourWeeksAgo));
        const delta = progressIndex !== null && progressIndex4wAgo !== null ? progressIndex - progressIndex4wAgo : null;
        const bestRaw = exerciseRollingBestRaw(sessionLogs, exercise.id, exercise.metric, '', 999);
        const lastSet = mostRecentQualifyingSet(sessionLogs, exercise.id);
        const variantLabel = ladder && lastSet?.variantId ? ladder.variants.find((v) => v.id === lastSet.variantId)?.label : undefined;
        return { skill, exercise, progressIndex, delta, bestRaw, variantLabel };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionLogs, dailyEntriesArray, settings.startWeightKg],
  );

  // --- Difficulty timeline: effective level per skill, per week ---
  const difficultyTimeline = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const w = i + 1;
      const point: Record<string, number | undefined> & { week: number } = { week: w };
      for (const skill of SKILLS) {
        const exercise = program.find((e) => e.id === skill.exerciseId);
        if (!exercise) continue;
        const ladder = ladderFor(exercise);
        let best: number | undefined;
        for (const session of Object.values(sessionLogs)) {
          if (session.week !== w) continue;
          const log = session.exercises.find((e) => e.exerciseId === exercise.id);
          if (!log) continue;
          for (const set of log.sets) {
            if (!isQualifyingSet(set)) continue;
            const level = effectiveLevelForSet(exercise, ladder, set);
            best = best === undefined ? level : Math.max(best, level);
          }
        }
        point[skill.id] = best;
      }
      return point;
    });
  }, [sessionLogs]);

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
        name: program.find((e) => e.id === exerciseId)?.name ?? exerciseId,
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

      <section className="mt-4 grid grid-cols-2 gap-2">
        {skillHeadlines.map((h) => {
          if (!h) return null;
          const unit = h.exercise.metric === 'hold' || h.exercise.metric === 'attempts' ? 's' : '';
          return (
            <Card key={h.skill.id}>
              <div className="text-xs uppercase tracking-wide text-muted">{h.skill.label}</div>
              <div className="mt-1 text-xs text-muted">{h.variantLabel ?? '—'}</div>
              <div className="mt-1 font-display text-2xl tabular-nums text-text">
                {h.bestRaw !== null ? `${h.bestRaw}${unit}` : '—'}
              </div>
              <div className="mt-1 text-xs tabular-nums text-muted">
                Index {h.progressIndex !== null ? h.progressIndex.toFixed(0) : '—'}
                {h.delta !== null && (
                  <span className={h.delta >= 0 ? 'text-good' : 'text-bad'}>
                    {' '}
                    ({h.delta >= 0 ? '+' : ''}
                    {h.delta.toFixed(0)} vs 4wk ago)
                  </span>
                )}
              </div>
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
              ladder={selectedLadder}
              sessionLogs={sessionLogs}
              dailyEntries={dailyEntriesArray}
              settings={settings}
            />
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <SectionHeader>Difficulty timeline</SectionHeader>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={difficultyTimeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="week"
              type="number"
              domain={[1, 12]}
              ticks={[1, 3, 5, 7, 9, 11]}
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
            />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} width={24} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
              labelFormatter={(w) => `Week ${w}`}
            />
            {SKILLS.map((skill) => (
              <Line
                key={skill.id}
                dataKey={skill.id}
                name={skill.label}
                type="stepAfter"
                stroke={SKILL_COLOR[skill.id]}
                strokeWidth={2}
                dot={{ r: 2, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          {SKILLS.map((skill) => (
            <span key={skill.id} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SKILL_COLOR[skill.id] }} />
              {skill.label}
            </span>
          ))}
        </div>

        <div className="mt-3 border-t border-line pt-2">
          <span className="text-xs uppercase tracking-wide text-muted">Progression events</span>
          {progressionEvents.length === 0 ? (
            <p className="mt-1 text-xs text-muted">No progression events logged yet.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-xs text-text">
              {progressionEvents
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((event) => (
                  <li key={event.id}>
                    {event.date} · {program.find((e) => e.id === event.exerciseId)?.name ?? event.exerciseId} —{' '}
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
