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
import type { Readiness } from '../domain/types';
import PhaseBadge from '../components/PhaseBadge';
import ReadinessCheckIn from '../components/ReadinessCheckIn';
import ExerciseCard from '../components/ExerciseCard';

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

        {amExercises.length > 0 && (
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
            {isSunday && isBenchmarkWeek && (
              <p className="mt-2 text-xs text-muted">Benchmark form — added in a later step.</p>
            )}
            <button
              type="button"
              onClick={handleStartMain}
              className="mt-3 min-h-11 w-full rounded bg-good text-base font-medium text-bg"
            >
              {mainInProgress ? 'Resume session' : isSunday ? 'Start run' : 'Start session'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
