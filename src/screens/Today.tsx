// SPEC.md section 7.1. Day navigation is a v1.1 addition — SPEC-V1.1.md prompt 3.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, isAfter, isBefore, parseISO, subDays } from 'date-fns';
import { useStore } from '../store/useStore';
import { program, dayTitles } from '../data/program';
import {
  currentWeek,
  dayIdForDate,
  exercisesFor,
  isBlockComplete,
  phaseForWeek,
  resolvePrescription,
} from '../domain/phase';
import { startOfToday, todayISO } from '../domain/clock';
import { weeklyRatePct } from '../domain/body';
import {
  elbowVolumeWarning,
  isElbowWarningDay,
  isShoulderWarningDay,
  optionalRunGate,
  shoulderVolumeWarning,
} from '../domain/readiness';
import { doNotProgressConditions, weeklyProgressionVariables } from '../data/mobility';
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

  const [showReadiness, setShowReadiness] = useState(false);

  const todayDate = startOfToday();
  const blockStartDate = parseISO(settings.blockStartDate);
  const [selectedDate, setSelectedDate] = useState(todayDate);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayId = dayIdForDate(selectedDate);
  const week = currentWeek(selectedDate, settings.blockStartDate);
  const phase = phaseForWeek(week);
  const blockComplete = isBlockComplete(todayDate, settings.blockStartDate);

  const isViewingToday = dateStr === todayISO();
  const canGoBack = isAfter(selectedDate, blockStartDate);
  const canGoForward = isBefore(selectedDate, todayDate);

  function goToPreviousDay() {
    setSelectedDate((d) => (isAfter(d, blockStartDate) ? subDays(d, 1) : d));
  }
  function goToNextDay() {
    setSelectedDate((d) => (isBefore(d, todayDate) ? addDays(d, 1) : d));
  }
  function goToToday() {
    setSelectedDate(todayDate);
  }

  const amExercises = useMemo(() => exercisesFor(program, dayId, 'am', week), [dayId, week]);
  const mainExercises = useMemo(() => exercisesFor(program, dayId, 'main', week), [dayId, week]);

  const amSession = sessionLogs[`${dateStr}:am`];
  const amInProgress = !!amSession && !amSession.completedAt;

  const mainSession = sessionLogs[`${dateStr}:main`];
  const mainInProgress = !!mainSession && !mainSession.completedAt;

  const isSunday = dayId === 'sun';
  const isBenchmarkWeek = week === 1 || week === 6 || week === 12;
  const mobilityVariable = weeklyProgressionVariables.find((v) => v.week === week)?.description ?? null;

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

  function handleStartAm() {
    // No readiness gate for AM (SPEC.md 7.1 reserves that check-in for Main);
    // startSession is idempotent, so this doubles as "resume" once a session exists.
    startSession({ date: dateStr, block: 'am', day: dayId, week, phase });
    navigate(`/session/${dateStr}/am`);
  }

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
      <PhaseBadge week={week} phase={phase} dateLabel={format(selectedDate, 'EEE d MMM')} />

      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={goToPreviousDay}
          className="min-h-11 min-w-11 text-text disabled:opacity-30"
        >
          ←
        </button>
        {isViewingToday ? (
          <span className="text-sm text-muted">Today</span>
        ) : (
          <button
            type="button"
            onClick={goToToday}
            className="min-h-11 rounded bg-warn px-3 text-xs font-medium text-bg"
          >
            Viewing {format(selectedDate, 'EEE d MMM')} — tap to jump to today
          </button>
        )}
        <button
          type="button"
          disabled={!canGoForward}
          onClick={goToNextDay}
          className="min-h-11 min-w-11 text-text disabled:opacity-30"
        >
          →
        </button>
      </div>

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
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-text">
                  AM · {amExercises.length} exercise{amExercises.length === 1 ? '' : 's'}
                </span>
                {amSession?.completedAt && <span className="text-xs text-good">Done ✓</span>}
              </div>

              {mobilityVariable && (
                <div className="mt-2 rounded bg-surface-2 px-2 py-1.5 text-xs">
                  <span className="text-muted">This week: </span>
                  <span className="text-text">{mobilityVariable}</span>
                </div>
              )}

              <div className="mt-2 divide-y divide-line">
                {amExercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    order={exercise.order}
                    exercise={exercise}
                    prescription={resolvePrescription(exercise, week)}
                  />
                ))}
              </div>

              <details className="mt-2 text-xs text-muted">
                <summary>Don't progress if…</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {doNotProgressConditions.map((condition) => (
                    <li key={condition}>{condition}</li>
                  ))}
                </ul>
              </details>

              <button
                type="button"
                onClick={handleStartAm}
                className="mt-3 min-h-11 w-full rounded bg-good text-base font-medium text-bg"
              >
                {amInProgress ? 'Resume AM session' : 'Start AM session'}
              </button>
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
