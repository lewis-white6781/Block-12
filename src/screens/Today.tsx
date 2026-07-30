// SPEC.md section 7.1.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useStore } from '../store/useStore';
import { program, dayTitles } from '../data/program';
import {
  currentWeek,
  dayIdForDate,
  isBlockComplete,
  phaseForWeek,
  resolvePrescription,
} from '../domain/phase';
import { weeklyRatePct } from '../domain/body';
import {
  elbowVolumeWarning,
  isElbowWarningDay,
  isShoulderWarningDay,
  optionalRunGate,
  shoulderVolumeWarning,
} from '../domain/readiness';
import type { Readiness, SessionLog } from '../domain/types';
import PhaseBadge from '../components/PhaseBadge';
import ReadinessCheckIn from '../components/ReadinessCheckIn';
import ExerciseCard from '../components/ExerciseCard';
import DailyEntryFields from '../components/DailyEntryFields';
import BenchmarkForm from '../components/BenchmarkForm';

/** Main-session readiness check-ins as of a date, most-recent-first (SPEC.md 6.9, 6.10). */
function recentMainReadiness(sessionLogs: Record<string, SessionLog>, asOfDate: string, n = 3): Readiness[] {
  return Object.values(sessionLogs)
    .filter((s) => s.block === 'main' && s.date <= asOfDate && s.readiness)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, n)
    .map((s) => s.readiness as Readiness);
}

export default function Today() {
  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const sessionLogs = useStore((s) => s.sessionLogs);
  const startSession = useStore((s) => s.startSession);
  const toggleAmChecklistItem = useStore((s) => s.toggleAmChecklistItem);

  const [showReadiness, setShowReadiness] = useState(false);
  const [amExpanded, setAmExpanded] = useState(false);

  const today = new Date();
  const dateStr = format(today, 'yyyy-MM-dd');
  const dayId = dayIdForDate(today);
  const week = currentWeek(today, settings.blockStartDate);
  const phase = phaseForWeek(week);
  const blockComplete = isBlockComplete(today, settings.blockStartDate);

  const dayExercises = useMemo(
    () => program.filter((e) => e.day === dayId).sort((a, b) => a.order - b.order),
    [dayId],
  );
  const amExercises = dayExercises.filter((e) => e.block === 'am');
  const mainExercises = dayExercises
    .filter((e) => e.block === 'main')
    .filter((e) => resolvePrescription(e, week) !== null);

  const amSession = sessionLogs[`${dateStr}:am`];
  const amDoneIds = new Set(
    (amSession?.exercises ?? []).filter((e) => e.sets.length > 0).map((e) => e.exerciseId),
  );
  const amDoneCount = amExercises.filter((e) => amDoneIds.has(e.id)).length;
  const amAllDone = amExercises.length > 0 && amDoneCount === amExercises.length;
  const amCollapsed = amAllDone && !amExpanded;

  const mainSession = sessionLogs[`${dateStr}:main`];
  const mainInProgress = !!mainSession && !mainSession.completedAt;

  const isSunday = dayId === 'sun';
  const isBenchmarkWeek = week === 1 || week === 6 || week === 12;

  const dailyEntries = useStore((s) => s.dailyEntries);
  const recentReadiness = useMemo(
    () => recentMainReadiness(sessionLogs, dateStr),
    [sessionLogs, dateStr],
  );
  const elbowWarning = isElbowWarningDay(dayId) ? elbowVolumeWarning(recentReadiness) : null;
  const shoulderWarning = isShoulderWarningDay(dayId) ? shoulderVolumeWarning(recentReadiness) : null;
  const runGate =
    dayId === 'mon'
      ? optionalRunGate({
          week,
          sessionLogs,
          recentReadiness,
          weeklyRatePct: weeklyRatePct(Object.values(dailyEntries), dateStr),
        })
      : null;

  function handleStartMain() {
    if (mainInProgress) {
      navigate(`/session/${dateStr}/main`);
      return;
    }
    setShowReadiness(true);
  }

  function handleReadinessSubmit(readiness: Readiness) {
    startSession({ date: dateStr, block: 'main', day: dayId, week, phase, readiness });
    setShowReadiness(false);
    navigate(`/session/${dateStr}/main`);
  }

  if (blockComplete) {
    return (
      <div className="p-4">
        <h1 className="font-display text-2xl text-text">Block complete</h1>
        <p className="mt-2 text-sm text-muted">
          Week 12 has passed.{' '}
          <button className="underline" onClick={() => navigate('/review')}>
            Open Review
          </button>
        </p>
      </div>
    );
  }

  if (showReadiness) {
    return (
      <ReadinessCheckIn
        onSubmit={handleReadinessSubmit}
        onCancel={() => setShowReadiness(false)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PhaseBadge week={week} phase={phase} dateLabel={format(today, 'EEE d MMM')} />

      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="font-display text-lg text-text">{dayTitles[dayId]}</h2>

        {elbowWarning && (
          <div className="mt-3 rounded bg-warn px-3 py-2 text-sm text-bg">{elbowWarning.message}</div>
        )}
        {shoulderWarning && (
          <div className="mt-3 rounded bg-warn px-3 py-2 text-sm text-bg">{shoulderWarning.message}</div>
        )}

        {runGate && week >= 3 && (
          <section className="mt-4 rounded border border-line bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text">Optional second run</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  runGate.eligible ? 'bg-good text-bg' : 'bg-bad text-bg'
                }`}
              >
                {runGate.eligible ? 'Go' : 'Not yet'}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {runGate.conditions.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-xs">
                  <span className={c.met ? 'text-good' : 'text-bad'}>{c.met ? '✓' : '✗'}</span>
                  <span className="text-muted">
                    {c.label} — {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isSunday && isBenchmarkWeek ? (
          <section className="mt-4">
            <BenchmarkForm week={week} />
          </section>
        ) : (
          amExercises.length > 0 && (
          <section className="mt-4 rounded border border-line bg-surface p-3">
            <button
              type="button"
              className="flex w-full min-h-11 items-center justify-between text-left"
              onClick={() => setAmExpanded((v) => !v)}
            >
              <span className="text-sm text-text">AM · {dayTitles[dayId]}</span>
              <span className="tabular-nums text-muted">
                {amDoneCount}/{amExercises.length} {amAllDone ? '✓' : ''}
              </span>
            </button>
            {!amCollapsed && (
              <ul className="mt-2 space-y-1">
                {amExercises.map((exercise) => {
                  const done = amDoneIds.has(exercise.id);
                  return (
                    <li key={exercise.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center gap-2 text-left text-sm text-text"
                        onClick={() =>
                          toggleAmChecklistItem(exercise.id, {
                            date: dateStr,
                            block: 'am',
                            day: dayId,
                            week,
                            phase,
                          })
                        }
                      >
                        <span>{done ? '✓' : '○'}</span>
                        <span>{exercise.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          )
        )}

        {mainExercises.length === 0 ? (
          <section className="mt-4 rounded border border-line bg-surface p-3">
            <p className="text-sm text-text">No hard training today</p>
            <p className="mt-1 text-xs text-muted">
              Mobility checklist above. Don't forget to log weight and calories.
            </p>
          </section>
        ) : (
          <section className="mt-4 rounded border border-line bg-surface p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-text">
                {isSunday ? 'RUN' : 'MAIN'} · {mainExercises.length} exercise
                {mainExercises.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-2 divide-y divide-line">
              {mainExercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  order={exercise.order}
                  exercise={exercise}
                  prescription={resolvePrescription(exercise, week)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleStartMain}
              className="mt-3 min-h-11 w-full rounded bg-good text-base font-medium text-bg"
            >
              {mainInProgress ? 'Resume session' : isSunday ? 'Start run' : 'Start session'}
            </button>
          </section>
        )}

        <section className="mt-4 rounded border border-line bg-surface p-3">
          <DailyEntryFields date={dateStr} showSummary />
        </section>

        {isSunday && (
          <button
            type="button"
            onClick={() => navigate('/review')}
            className="mt-4 min-h-11 w-full rounded border border-line text-sm text-text"
          >
            Open this week's Review
          </button>
        )}
      </div>
    </div>
  );
}
