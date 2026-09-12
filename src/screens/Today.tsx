// SPEC.md section 7.1. Day navigation is a v1.1 addition — SPEC-V1.1.md prompt 3,
// widened to the whole 84-day block in v3.0 — SPEC-V3.0.md section 4.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useStore } from '../store/useStore';
import { dayTitles, program, sessionTitles } from '../data/program';
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
import { jointVolumeWarnings } from '../domain/readiness';
import { doNotProgressConditions, isBenchmarkWeek, weeklyProgressionVariables } from '../data/mobility';
import { detectStagnation } from '../domain/analysis';
import { buildPlainHistory } from '../domain/performance';
import { daysWithLoggedWeight } from '../domain/review';
import type { Block, Readiness, SessionLog } from '../domain/types';
import PhaseBadge from '../components/PhaseBadge';
import ReadinessCheckIn from '../components/ReadinessCheckIn';
import ExerciseCard from '../components/ExerciseCard';
import DailyEntryFields from '../components/DailyEntryFields';
import BenchmarkForm from '../components/BenchmarkForm';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import PagerNav from '../components/PagerNav';

const BLOCK_ORDER: Block[] = ['am', 'main', 'later'];
const BLOCK_LABEL: Record<Block, string> = { am: 'AM', main: 'Main', later: 'Later' };

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
        const logged = BLOCK_ORDER.some(
          (block) => sessionLogs[`${date}:${block}`]?.exercises.some((e) => e.sets.length > 0) ?? false,
        );
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

  // v4.0: three slots per day, not two. Wednesday runs all three; Thursday runs
  // one. Each card is hidden when the day prescribes nothing for that slot, so
  // the screen shows the day's actual shape rather than a fixed skeleton.
  const blocks = useMemo(
    () =>
      BLOCK_ORDER.map((block) => ({
        block,
        title: sessionTitles[dayId][block],
        exercises: exercisesFor(program, dayId, block, week),
      })).filter((b) => b.exercises.length > 0),
    [dayId, week],
  );
  const amExercises = useMemo(() => exercisesFor(program, dayId, 'am', week), [dayId, week]);
  const mainExercises = useMemo(() => exercisesFor(program, dayId, 'main', week), [dayId, week]);

  const isSunday = dayId === 'sun';
  const mobilityVariable = weeklyProgressionVariables.find((v) => v.week === week)?.description ?? null;

  const dailyEntries = useStore((s) => s.dailyEntries);
  const recentReadiness = useMemo(
    () => recentMainReadiness(sessionLogs, dateStr),
    [sessionLogs, dateStr],
  );
  const jointWarnings = useMemo(
    () => jointVolumeWarnings(dayId, recentReadiness),
    [dayId, recentReadiness],
  );

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

  function openSession(block: Block, readiness?: Readiness) {
    // startSession is idempotent, so this doubles as "resume" once one exists.
    startSession({ date: dateStr, block, day: dayId, week, phase, readiness });
    navigate(`/session/${dateStr}/${block}`);
  }

  function handleStart(block: Block) {
    // The readiness check-in gates the main lift only. AM is grease-the-groove
    // at RPE 4–5 and the later slot is a recovery run or a stretch — neither is
    // a session you would autoregulate out of, and asking would just add a
    // five-slider form to a ten-minute jog.
    const session = sessionLogs[`${dateStr}:${block}`];
    if (block !== 'main' || (session && !session.completedAt)) {
      openSession(block);
      return;
    }
    setShowReadiness(true);
  }

  function handleReadinessSubmit(readiness: Readiness) {
    setShowReadiness(false);
    openSession('main', readiness);
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

        {jointWarnings.map((warning) => (
          <div key={warning.message} className="mt-3 rounded bg-warn px-3 py-2 text-sm text-bg">
            {warning.message}
          </div>
        ))}

        {/* Benchmarks are measured on the Sunday of weeks 1 and 12. Sunday
            no longer has an AM block for this to displace, so it sits above the
            day's sessions rather than replacing one. */}
        {isSunday && isBenchmarkWeek(week) && (
          <section className="mt-4">
            <BenchmarkForm week={week} />
          </section>
        )}

        {blocks.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-text">Nothing prescribed today</p>
            <p className="mt-1 text-xs text-muted">Don't forget to log weight and calories.</p>
          </Card>
        ) : (
          blocks.map(({ block, title, exercises }) => {
            const session = sessionLogs[`${dateStr}:${block}`];
            const inProgress = !!session && !session.completedAt;
            // GTG blocks are prescribed in ROUNDS of the whole list, not sets of
            // each item, so the header has to say which it means.
            const rounds = exercises[0]?.setsLabel === 'rounds'
              ? resolvePrescription(exercises[0], week)?.sets
              : undefined;

            return (
              <Card key={block} className="mt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <SectionHeader>
                    {BLOCK_LABEL[block]} ·{' '}
                    {rounds !== undefined
                      ? `${rounds} round${rounds === 1 ? '' : 's'}`
                      : `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`}
                  </SectionHeader>
                  {session?.completedAt && <span className="shrink-0 text-xs text-good">Done ✓</span>}
                </div>
                <h3 className="mt-1 text-sm text-text">{title}</h3>

                {block === 'later' && mobilityVariable && exercises[0]?.rpeScale === 'stretch' && (
                  <div className="mt-2 rounded bg-surface-2 px-2 py-1.5 text-xs">
                    <span className="text-muted">This week: </span>
                    <span className="text-text">{mobilityVariable}</span>
                  </div>
                )}

                <div className="mt-2 divide-y divide-line">
                  {exercises.map((exercise) => (
                    <ExerciseCard
                      key={exercise.id}
                      order={exercise.order}
                      exercise={exercise}
                      prescription={resolvePrescription(exercise, week)}
                    />
                  ))}
                </div>

                {block === 'later' && exercises[0]?.rpeScale === 'stretch' && (
                  <details className="mt-2 text-xs text-muted">
                    <summary>Don't progress if…</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {doNotProgressConditions.map((condition) => (
                        <li key={condition}>{condition}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <button
                  type="button"
                  onClick={() => handleStart(block)}
                  className="mt-3 min-h-11 w-full rounded bg-good text-base font-medium text-bg"
                >
                  {inProgress ? 'Resume session' : `Start ${BLOCK_LABEL[block].toLowerCase()}`}
                </button>
              </Card>
            );
          })
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
