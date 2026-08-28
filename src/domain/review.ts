// Weekly review assembly — SPEC.md section 7.6.
import { addDays, format, parseISO } from 'date-fns';
import {
  SKILLS,
  churnGuardrails,
  collapseTrainingGuardrails,
  detectStagnation,
  leverageJumpGuardrails,
  oneVariableOverrideCount,
  weeklyStopRuleFirings,
} from './analysis';
import type { GuardrailFiring, StagnationResult, StopRuleResult } from './analysis';
import { corridorStatus, rolling7Calories, rolling7Carbs, rolling7Fat, rolling7Weight, weeklyRateKg } from './body';
import type { CorridorStatus } from './body';
import { benchmarks, isBenchmarkWeek } from '../data/mobility';
import { program } from '../data/program';
import { dayIdForDate, exercisesFor, phaseForWeek } from './phase';
import { bestAsOf, bestBySession, bestOverall, buildPlainHistory, trend } from './performance';
import type { Best, Trend } from './performance';
import { isQualifyingSet } from './scoring';
import type {
  BenchmarkEntry,
  Block,
  DailyEntry,
  DayId,
  Exercise,
  Ladder,
  Phase,
  ProgressionEvent,
  Readiness,
  SessionLog,
  Settings,
} from './types';

const DAY_IDS: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const BLOCKS: Block[] = ['am', 'main', 'later'];

/**
 * Sessions planned this week, counted from the program rather than stated as a
 * constant. v4.0 made the weekly total variable: the Wednesday recovery run has
 * no volume in weeks 1, 2 and 4, so a hardcoded number would mark three weeks
 * permanently incomplete.
 */
export function plannedSessions(week: number): Record<Block, number> {
  const counts: Record<Block, number> = { am: 0, main: 0, later: 0 };
  for (const day of DAY_IDS) {
    for (const block of BLOCKS) {
      if (exercisesFor(program, day, block, week).length > 0) counts[block] += 1;
    }
  }
  return counts;
}

export const PHASE_NOTES: Record<Phase, string> = {
  baseline: 'Wave 1 opens. Establish honest RPE 8 numbers on every movement — everything after this is measured against them.',
  reinforce: 'Same work, same numbers, better execution. Reinforce the baseline rather than beating it.',
  overload: 'The heavy week of the wave. Sets go up, RPE goes up, technique does not slip.',
  deload: 'End of a wave. Volume roughly halves and RPE drops to ~7 so tendons and legs catch up before the next one.',
  rebuild: 'Wave opener. Rebuild to the previous wave\'s loading, no higher — the overload week is where you spend.',
  peak: 'Highest gym loading of the block. After this, lifting gives ground to running.',
  marathonPeak: 'Running peaks: the longest run of the block. Gym volume steps back to pay for it.',
  taper: 'Reduce fatigue. Nothing to prove here — the race taper continues after week 12.',
};

export interface WeeklyReview {
  week: number;
  phase: Phase;
  sessionsCompleted: Record<Block, number>;
  sessionsPlanned: Record<Block, number>;
  weight: {
    meanKg: number | null;
    rateKgPerWeek: number | null;
    status: CorridorStatus | null;
  };
  nutrition: {
    proteinAdherenceDays: number;
    meanCalories: number | null;
    meanCarbsG: number | null;
    meanFatG: number | null;
  };
  // v3.0: plain bests in the movement's own unit instead of a unitless index
  // (SPEC-V3.0.md section 2). `previous` is the best as of the end of the
  // prior week, so the pair reads "was X, now Y".
  skillDeltas: {
    skill: (typeof SKILLS)[number];
    current: Best | null;
    previous: Best | null;
    trend: Trend | null;
  }[];
  firedFlags: {
    stagnation: StagnationResult[];
    guardrails: GuardrailFiring[];
    stopRules: { exerciseId: string; result: StopRuleResult }[];
    oneVariableOverrides: number;
  };
  nextWeek: {
    week: number;
    phase: Phase;
    phaseNote: string;
    mobilityVariable: string | null;
    suggestedProgressions: StagnationResult[];
  } | null;
  benchmarkWeek: boolean;
}

export interface ReviewInput {
  week: number;
  settings: Settings;
  program: Exercise[];
  ladders: Ladder[];
  sessionLogs: Record<string, SessionLog>;
  dailyEntries: Record<string, DailyEntry>;
  progressionEvents: ProgressionEvent[];
  mobilityVariableForWeek: (week: number) => string | null;
}

function weekDateRange(blockStartDate: string, week: number): { start: string; end: string } {
  const blockStart = parseISO(blockStartDate);
  return {
    start: format(addDays(blockStart, (week - 1) * 7), 'yyyy-MM-dd'),
    end: format(addDays(blockStart, week * 7 - 1), 'yyyy-MM-dd'),
  };
}

function weekOfDateFor(blockStartDate: string) {
  return (date: string) => {
    const days = Math.floor((parseISO(date).getTime() - parseISO(blockStartDate).getTime()) / 86_400_000);
    return Math.min(12, Math.max(1, Math.floor(days / 7) + 1));
  };
}


function isAmDayComplete(session: SessionLog | undefined, exercisesForDay: Exercise[]): boolean {
  if (!session) return false;
  const amExercises = exercisesForDay.filter((e) => e.block === 'am');
  if (amExercises.length === 0) return false;
  return amExercises.every((e) => session.exercises.some((log) => log.exerciseId === e.id && log.sets.length > 0));
}

function recentReadiness(sessionLogs: Record<string, SessionLog>, asOfDate: string, n = 3): Readiness[] {
  return Object.values(sessionLogs)
    .filter((s) => s.block === 'main' && s.date <= asOfDate && s.readiness)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, n)
    .map((s) => s.readiness as Readiness);
}

export function daysWithLoggedWeight(dailyEntries: DailyEntry[], asOfDate: string): number {
  const asOf = parseISO(asOfDate);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const date = format(addDays(asOf, -i), 'yyyy-MM-dd');
    if (dailyEntries.some((e) => e.date === date && e.weightKg !== undefined)) count++;
  }
  return count;
}

export function buildWeeklyReview(input: ReviewInput): WeeklyReview {
  const { week, settings, program, ladders, sessionLogs, dailyEntries, progressionEvents, mobilityVariableForWeek } =
    input;
  const phase = phaseForWeek(week);
  const { start, end } = weekDateRange(settings.blockStartDate, week);
  const dailyEntriesArray = Object.values(dailyEntries);
  const weekOfDate = weekOfDateFor(settings.blockStartDate);

  // --- sessions completed vs planned ---
  const completed: Record<Block, number> = { am: 0, main: 0, later: 0 };
  for (let i = 0; i < 7; i++) {
    const date = format(addDays(parseISO(start), i), 'yyyy-MM-dd');
    const dayId = dayIdForDate(parseISO(date));
    const exercisesForDay = program.filter((e) => e.day === dayId);
    if (sessionLogs[`${date}:main`]?.completedAt) completed.main++;
    if (sessionLogs[`${date}:later`]?.completedAt) completed.later++;
    if (isAmDayComplete(sessionLogs[`${date}:am`], exercisesForDay)) completed.am++;
  }
  const planned = plannedSessions(week);

  // --- weight & nutrition ---
  const meanKg = rolling7Weight(dailyEntriesArray, end);
  const rateKg = weeklyRateKg(dailyEntriesArray, end);
  const weekEntries = dailyEntriesArray.filter((e) => e.date >= start && e.date <= end);
  const proteinAdherenceDays = weekEntries.filter(
    (e) =>
      e.proteinG !== undefined && e.proteinG >= settings.proteinTargetLow && e.proteinG <= settings.proteinTargetHigh,
  ).length;
  const meanCalories = rolling7Calories(dailyEntriesArray, end);
  const meanCarbsG = rolling7Carbs(dailyEntriesArray, end);
  const meanFatG = rolling7Fat(dailyEntriesArray, end);

  // --- per-skill best, and what it was a week ago ---
  const skillDeltas = SKILLS.map((skill) => {
    const exercise = program.find((e) => e.id === skill.exerciseId);
    if (!exercise) return { skill, current: null, previous: null, trend: null };
    const history = bestBySession(sessionLogs, exercise).filter((h) => h.date <= end);
    const priorWeekEnd = format(addDays(parseISO(end), -7), 'yyyy-MM-dd');
    return {
      skill,
      current: bestOverall(history),
      previous: bestAsOf(history, priorWeekEnd),
      trend: trend(history),
    };
  });

  // --- fired flags ---
  // AM exercises are tracked as of v1.1 (SPEC-V1.1.md section 2), so stagnation
  // detection and next-week suggestions now cover AM alongside Main.
  const trackedExercises = program.filter((e) => e.tracked);
  const stagnation: StagnationResult[] = [];
  for (const exercise of trackedExercises) {
    const history = buildPlainHistory(sessionLogs, exercise).filter((r) => r.date <= end);
    const result = detectStagnation({
      exercise,
      history,
      health: {
        exerciseId: exercise.id,
        recentReadiness: recentReadiness(sessionLogs, end),
        daysWithLoggedWeightInLast7: daysWithLoggedWeight(dailyEntriesArray, end),
      },
      phase,
      progressionEvents,
    });
    if (result) stagnation.push(result);
  }

  const guardrails: GuardrailFiring[] = [
    ...churnGuardrails(progressionEvents, program, weekOfDate, week),
    ...leverageJumpGuardrails(progressionEvents, program, ladders),
    ...collapseTrainingGuardrails(sessionLogs, program, week),
  ];

  const stopRules = weeklyStopRuleFirings(sessionLogs, program, week);
  const oneVariableOverrides = oneVariableOverrideCount(progressionEvents, weekOfDate, week);

  // --- next week's focus ---
  const nextWeek =
    week < 12
      ? (() => {
          const nw = week + 1;
          const nextPhase = phaseForWeek(nw);
          const suggestions = trackedExercises
            .map((exercise) => {
              const history = buildPlainHistory(sessionLogs, exercise).filter((r) => r.date <= end);
              return detectStagnation({
                exercise,
                history,
                health: {
                  exerciseId: exercise.id,
                  recentReadiness: recentReadiness(sessionLogs, end),
                  daysWithLoggedWeightInLast7: daysWithLoggedWeight(dailyEntriesArray, end),
                },
                phase: nextPhase,
                progressionEvents,
              });
            })
            .filter((r): r is StagnationResult => r !== null && r.type === 'stagnant');
          return {
            week: nw,
            phase: nextPhase,
            phaseNote: PHASE_NOTES[nextPhase],
            mobilityVariable: mobilityVariableForWeek(nw),
            suggestedProgressions: suggestions,
          };
        })()
      : null;

  return {
    week,
    phase,
    sessionsCompleted: completed,
    sessionsPlanned: planned,
    weight: { meanKg, rateKgPerWeek: rateKg, status: corridorStatus(rateKg) },
    nutrition: { proteinAdherenceDays, meanCalories, meanCarbsG, meanFatG },
    skillDeltas,
    firedFlags: { stagnation, guardrails, stopRules, oneVariableOverrides },
    nextWeek,
    benchmarkWeek: isBenchmarkWeek(week),
  };
}

// ---------------------------------------------------------------------------
// Week-12 end-of-block target checklist (SPEC.md 5.10, 7.6) — auto-marked
// only where the logged data can actually decide it; everything else is left
// unknown rather than guessed, per the "never invent" rule.
// ---------------------------------------------------------------------------
export type TargetStatus = 'met' | 'unmet' | 'unknown';

export interface TargetCheckItem {
  item: string;
  status: TargetStatus;
}

export interface TargetCheckGroup {
  id: string;
  label: string;
  items: TargetCheckItem[];
}

function bestQualifyingSetInWeek(
  sessionLogs: Record<string, SessionLog>,
  exerciseId: string,
  week: number,
): { seconds?: number; reps?: number; addedKg?: number; variantId?: string; assistanceTier?: number } | undefined {
  let best: ReturnType<typeof bestQualifyingSetInWeek> = undefined;
  let bestValue = -Infinity;
  for (const session of Object.values(sessionLogs)) {
    if (session.week !== week) continue;
    const log = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!log) continue;
    for (const set of log.sets) {
      if (!isQualifyingSet(set)) continue;
      const value = set.seconds ?? set.reps ?? 0;
      if (value > bestValue) {
        bestValue = value;
        best = set;
      }
    }
  }
  return best;
}

function anyQualifyingSetInWeek(sessionLogs: Record<string, SessionLog>, exerciseId: string, week: number): boolean {
  return Object.values(sessionLogs).some(
    (s) => s.week === week && s.exercises.some((log) => log.exerciseId === exerciseId && log.sets.some(isQualifyingSet)),
  );
}

export function checkEndOfBlockTargets(input: {
  targetGroups: { id: string; label: string; items: string[] }[];
  sessionLogs: Record<string, SessionLog>;
  dailyEntries: Record<string, DailyEntry>;
  benchmarkEntries: Record<string, BenchmarkEntry>;
  settings: Settings;
  /**
  * Best across the last few sessions as a percentage of the weeks 1-2
  * baseline, in the movement's own unit. v3.0 replacement for the Exercise
  * Progress Index (SPEC-V3.0.md section 1) — the "broadly maintained" and
  * "no decline" targets below genuinely need a ratio, they just no longer
  * need a difficulty multiplier baked into it.
  */
  week12RetentionPct: (exerciseId: string) => number | null;
  /** Date the "current" weight target is evaluated as-of (caller supplies "today"). */
  asOfDate: string;
}): TargetCheckGroup[] {
  const { targetGroups, sessionLogs, dailyEntries, benchmarkEntries, settings, asOfDate } = input;
  const dailyEntriesArray = Object.values(dailyEntries);
  const currentWeightKg = rolling7Weight(dailyEntriesArray, asOfDate);

  /**
   * Longest total time spent on one exercise in a single session, in minutes.
   * The long run is prescribed as N blocks of 15 minutes, so its duration is
   * the SUM of a session's sets, not the best of them.
   */
  function longestSessionMinutes(exerciseId: string): number | null {
    let longest: number | null = null;
    for (const session of Object.values(sessionLogs)) {
      const log = session.exercises.find((e) => e.exerciseId === exerciseId);
      if (!log) continue;
      const total = log.sets.reduce((sum, set) => sum + (set.minutes ?? 0), 0);
      if (total > 0 && (longest === null || total > longest)) longest = total;
    }
    return longest;
  }

  /** Did a week-12 best beat the same exercise's week-1 best, in its own unit? */
  function improvedSinceWeek1(exerciseId: string): TargetStatus {
    const first = bestQualifyingSetInWeek(sessionLogs, exerciseId, 1);
    const last = bestQualifyingSetInWeek(sessionLogs, exerciseId, 12);
    if (!first || !last) return 'unknown';
    const value = (s: typeof first) => s?.seconds ?? s?.reps ?? 0;
    return value(last) >= value(first) ? 'met' : 'unmet';
  }

  function status(id: string, index: number): TargetStatus {
    // Body: "at target weight" — read from settings rather than a literal band,
    // so changing the goal in Settings changes what this checks.
    if (id === 'body' && index === 0) {
      if (currentWeightKg === null) return 'unknown';
      return currentWeightKg <= settings.targetWeightKg + 0.5 ? 'met' : 'unmet';
    }

    // Front lever: "stronger open advanced tuck or one-leg hold"
    if (id === 'frontLever' && index === 0) {
      const best = bestQualifyingSetInWeek(sessionLogs, 'fl-hold-primary', 12);
      if (!best) return 'unknown';
      const advanced = ['open-advanced-tuck', 'one-leg', 'alternating-one-leg', 'assisted-straddle', 'straddle', 'half-lay', 'lightly-assisted-full', 'full'];
      if (!best.variantId || !advanced.includes(best.variantId)) return 'unmet';
      return (best.seconds ?? 0) >= 6 ? 'met' : 'unmet';
    }

    // HSPU: "more ROM or reps in the primary pike HSPU"
    if (id === 'hspu' && index === 0) return improvedSinceWeek1('hspu-primary');

    // Strength: the two heavy exposures the block promises only to MAINTAIN
    // through a cut, not to improve. 95% of the block best is "maintained".
    if (id === 'strength' && index === 0) {
      const pullup = input.week12RetentionPct('ring-pullup');
      return pullup === null ? 'unknown' : pullup >= 95 ? 'met' : 'unmet';
    }
    if (id === 'strength' && index === 1) {
      const dip = input.week12RetentionPct('ring-dip');
      return dip === null ? 'unknown' : dip >= 95 ? 'met' : 'unmet';
    }

    // Core: the three movements with a ladder behind them.
    if (id === 'core' && index === 0) return improvedSinceWeek1('dragon-flag');
    if (id === 'core' && index === 1) return improvedSinceWeek1('standing-ab-wheel');
    if (id === 'core' && index === 2) return improvedSinceWeek1('windshield-wiper');

    // Flexibility: every one of the six chains moved the right way between the
    // week-1 and week-12 measurements. Three of them are lower-better.
    if (id === 'flexibility' && index === 0) {
      const first = benchmarkEntries['1'];
      const last = benchmarkEntries['12'];
      if (!first || !last) return 'unknown';
      const measured = benchmarks.filter(
        (b) => first.values[b.id] !== undefined && last.values[b.id] !== undefined,
      );
      if (measured.length === 0) return 'unknown';
      const improved = measured.every((b) =>
        b.direction === 'lower-better'
          ? last.values[b.id] < first.values[b.id]
          : last.values[b.id] > first.values[b.id],
      );
      return improved ? 'met' : 'unmet';
    }

    // Marathon: "long run built to 2+ hours"
    if (id === 'marathon' && index === 0) {
      const longest = longestSessionMinutes('sun-long-run');
      if (longest === null) return 'unknown';
      return longest >= 120 ? 'met' : 'unmet';
    }
    // Marathon: "comfortable 5–6 run weekly schedule" — met when week 12 was
    // actually run, not merely prescribed.
    if (id === 'marathon' && index === 1) {
      const runIds = ['tue-threshold', 'thu-easy-run', 'sat-easy-run', 'sun-long-run'];
      const run = runIds.filter((runId) => anyQualifyingSetInWeek(sessionLogs, runId, 12)).length;
      if (run === 0) return 'unknown';
      return run >= 4 ? 'met' : 'unmet';
    }

    return 'unknown';
  }

  void settings;
  return targetGroups.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map((item, index) => ({ item, status: status(group.id, index) })),
  }));
}
