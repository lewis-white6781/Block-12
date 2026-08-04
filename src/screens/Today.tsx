// SPEC.md section 7.1. Day navigation is a v1.1 addition — SPEC-V1.1.md prompt 3,
// widened to the whole 84-day block in v3.0 — SPEC-V3.0.md section 4.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useStore } from '../store/useStore';
import { program, dayTitles } from '../data/program';
import {
  BLOCK_DAYS,
  blockDayIndex,
  clampBlockDay,
  currentWeek,
  dateForBlockDay,
  dayIdForDate,
  exercisesFor,
  isBlockComplete,
  phaseForWeek,
  resolvePrescription,
} from '../domain/phase';
import { useToday } from '../hooks/useToday';
import { weeklyRatePct } from '../domain/body';
import {
  elbowVolumeWarning,
  isElbowWarningDay,
  isShoulderWarningDay,
  optionalRunGate,
  shoulderVolumeWarning,
} from '../domain/readiness';
import { doNotProgressConditions, weeklyProgressionVariables } from '../data/mobility';
import { detectStagnation } from '../domain/analysis';
import { buildPlainHistory } from '../domain/performance';
import { daysWithLoggedWeight } from '../domain/review';
import type { Readiness, SessionLog } from '../domain/types';
import PhaseBadge from '../components/PhaseBadge';
import ReadinessCheckIn from '../components/ReadinessCheckIn';
import ExerciseCard from '../components/ExerciseCard';
import DailyEntryFields from '../components/DailyEntryFields';
import BenchmarkForm from '../components/BenchmarkForm';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import PagerNav from '../components/PagerNav';

/**
 * The seven days of the displayed week, marked where something is logged —
 * SPEC-V3.0.md section 4. Makes "every day is saved, and reachable" visible in
 * one glance rather than something you have to page around to discover.
 */
function WeekStrip({
  selectedIndex,
  todayIndex,
  blockStartDate,
  sessionLogs,
  onPick,
}: {
  selectedIndex: number;
  todayIndex: number;
  blockStartDate: string;
  sessionLogs: Record<string, SessionLog>;
  onPick: (index: number) => void;
}) {
  const weekStart = Math.floor(selectedIndex / 7) * 7;

  return (
    <div className="mt-2 flex justify-between gap-1">
      {Array.from({ length: 7 }, (_, i) => {
        const index = weekStart + i;
        if (index >= BLOCK_DAYS) return <span key={i} className="min-h-11 flex-1" />;

        const date = format(dateForBlockDay(blockStartDate, index), 'yyyy-MM-dd');
        const logged =
          (sessionLogs[`${date}:main`]?.exercises.some((e) => e.sets.length > 0) ?? false) ||
          (sessionLogs[`${date}:am`]?.exercises.some((e) => e.sets.length > 0) ?? false);
        const isSelected = index === selectedIndex;

        return (
          <button
            key={index}
            type="button"
            onClick={() => onPick(index)}
            aria-current={isSelected ? 'date' : undefined}
            aria-label={format(dateForBlockDay(blockStartDate, index), 'EEE d MMM')}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center rounded text-[10px] ${
              isSelected ? 'bg-surface-2 text-text' : 'text-muted'
            }`}
          >
            <span>{format(dateForBlockDay(blockStartDate, index), 'EEEEE')}</span>
            <span
              className="mt-0.5 h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: logged ? 'var(--good)' : 'var(--line)',
                outline: index === todayIndex ? '1px solid var(--text)' : undefined,
                outlineOffset: '1px',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

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

  // `useToday` is live rather than mount-captured. Capturing it was the bug
  // that froze this pager: an installed PWA left on the home screen overnight
  // kept yesterday's "today" as its forward bound (SPEC-V3.0.md section 4).
  const todayDate = useToday();
  const todayIndex = blockDayIndex(todayDate, settings.blockStartDate);

  // The selected day is stored as a block-day INDEX, not a Date, so the single
  // clamp below is the only bound in the file — the v1.1 code duplicated it
  // between the handlers and the disabled props and they disagreed.
  const [selectedIndex, setSelectedIndex] = useState(() => clampBlockDay(todayIndex));
  const selectedDate = dateForBlockDay(settings.blockStartDate, selectedIndex);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayId = dayIdForDate(selectedDate);
  const week = currentWeek(selectedDate, settings.blockStartDate);
  const phase = phaseForWeek(week);
  const blockComplete = isBlockComplete(todayDate, settings.blockStartDate);

  const isViewingToday = selectedIndex === todayIndex;
  const isUpcoming = selectedIndex > todayIndex;
  // Every day of the block is reachable in both directions and every day is
  // editable — backwards to correct something forgotten, forwards to log ahead.
  const canGoBack = selectedIndex > 0;
  const canGoForward = selectedIndex < BLOCK_DAYS - 1;

  function goToPreviousDay() {
    setSelectedIndex((i) => clampBlockDay(i - 1));
  }
  function goToNextDay() {
    setSelectedIndex((i) => clampBlockDay(i + 1));
  }
  function goToToday() {
    setSelectedIndex(clampBlockDay(todayIndex));
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

  const progressionEvents = useStore((s) => s.progressionEvents);

  // Stagnation card (SPEC.md 7.1 wireframe, "⚠ pike-hspu flat 3 sessions") —
  // checked only against today's own exercises, main first then AM, so at
  // most one card shows and it's always something you can act on right now.
  const todaysStagnation = useMemo(() => {
    const dailyEntriesArray = Object.values(dailyEntries);
    for (const exercise of [...mainExercises, ...amExercises]) {
      const result = detectStagnation({
        exercise,
        history: buildPlainHistory(sessionLogs, exercise),
        health: {
          exerciseId: exercise.id,
          recentReadiness,
          daysWithLoggedWeightInLast7: daysWithLoggedWeight(dailyEntriesArray, dateStr),
        },
        phase,
        progressionEvents,
      });
      if (result) return result;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainExercises, amExercises, sessionLogs, dailyEntries, recentReadiness, dateStr, phase, progressionEvents, settings.startWeightKg]);

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

      <div className="border-b border-line bg-surface px-4 py-2">
        <PagerNav
          className="flex w-full items-center justify-between"
          onPrev={goToPreviousDay}
          onNext={goToNextDay}
          disablePrev={!canGoBack}
          disableNext={!canGoForward}
          center={
            isViewingToday ? (
              <span className="text-sm text-muted">Today</span>
            ) : (
              <button
                type="button"
                onClick={goToToday}
                className="min-h-11 rounded border border-line bg-surface-2 px-3 text-xs font-medium text-text"
              >
                Viewing {format(selectedDate, 'EEE d MMM')} — tap to jump to today
              </button>
            )
          }
        />
        <WeekStrip
          selectedIndex={selectedIndex}
          todayIndex={todayIndex}
          blockStartDate={settings.blockStartDate}
          sessionLogs={sessionLogs}
          onPick={setSelectedIndex}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* v3.0: a banner, not a takeover. Week 12 passing used to replace this
            screen entirely, which locked the athlete out of their own 12 weeks
            of data with no way back in (SPEC-V3.0.md section 4). */}
        {blockComplete && (
          <div className="mb-3 rounded bg-surface-2 px-3 py-2 text-sm text-text">
            Block complete — week 12 has passed. You can still page through every day.{' '}
            <button className="underline" onClick={() => navigate('/review')}>
              Open Review
            </button>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg text-text">{dayTitles[dayId]}</h2>
          {isUpcoming && (
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
              Upcoming
            </span>
          )}
        </div>

        {todaysStagnation && (
          <div
            className={`mt-3 rounded px-3 py-2 text-sm ${
              todaysStagnation.type === 'stagnant' ? 'bg-warn text-bg' : 'bg-surface-2 text-text'
            }`}
          >
            {todaysStagnation.type === 'stagnant' ? '⚠ ' : ''}
            {todaysStagnation.message}
          </div>
        )}

        {elbowWarning && (
          <div className="mt-3 rounded bg-warn px-3 py-2 text-sm text-bg">{elbowWarning.message}</div>
        )}
        {shoulderWarning && (
          <div className="mt-3 rounded bg-warn px-3 py-2 text-sm text-bg">{shoulderWarning.message}</div>
        )}

        {runGate && week >= 3 && (
          <Card className="mt-4">
            <div className="flex items-center justify-between">
              <SectionHeader>Optional second run</SectionHeader>
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
          </Card>
        )}

        {isSunday && isBenchmarkWeek ? (
          <section className="mt-4">
            <BenchmarkForm week={week} />
          </section>
        ) : (
          amExercises.length > 0 && (
            <Card className="mt-4">
              <div className="flex items-baseline justify-between">
                <SectionHeader>
                  AM · {amExercises.length} exercise{amExercises.length === 1 ? '' : 's'}
                </SectionHeader>
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
            </Card>
          )
        )}

        {mainExercises.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-text">No hard training today</p>
            <p className="mt-1 text-xs text-muted">
              Mobility checklist above. Don't forget to log weight and calories.
            </p>
          </Card>
        ) : (
          <Card className="mt-4">
            <div className="flex items-baseline justify-between">
              <SectionHeader>
                {isSunday ? 'RUN' : 'MAIN'} · {mainExercises.length} exercise
                {mainExercises.length === 1 ? '' : 's'}
              </SectionHeader>
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
          </Card>
        )}

        <Card className="mt-4">
          <DailyEntryFields date={dateStr} showSummary />
        </Card>

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
