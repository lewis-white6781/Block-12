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
import { isBenchmarkWeek } from '../data/mobility';
import { dailyChecks, program } from '../data/program';
import { PEAK_TEST_EXERCISE_IDS, PEAK_TEST_WEEKS } from '../data/targets';
import { dailyTargets } from './nutrition';
import { dayIdForDate, exercisesFor, phaseForWeek } from './phase';
import { bestAsOf, bestBySession, bestOf, bestOverall, buildPlainHistory, compareBests, trend } from './performance';
import type { Best, Trend } from './performance';
import type {
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

// Read off the "Sets by phase" table, SPEC-V6.0.md section 3.
export const PHASE_NOTES: Record<Phase, string> = {
  build1: '★ exercises 3 sets at RPE 8–8.5; everything else 3 sets. Set honest baselines — the rest of the block is measured against them.',
  build2: '★ exercises up to 4 sets at RPE 8.5. Top of the rep range on every set earns a harder progression or +1.25–2.5 kg.',
  deload: '★ exercises 2 sets at RPE 6–7; everything else 2 sets. Same exercises, no failure.',
  build3: '★ exercises 4 sets at RPE 8.5–9. Harder progressions where the rep range is topped out.',
  peak: 'Peak + test: ★ exercises 4–5 sets at RPE 9.5–10. Test the ★ lifts against week 1.',
  christmas: 'Floor sessions only — exercises 1–3 on the upper days, warm-up + 1, 2, 4 on Lower, 1–4 on Mobility + Core.',
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
  /** v6.0: each daily tick box, ticked days vs the days it was due. */
  checks: { id: string; label: string; done: number; planned: number }[];
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
  // v6.0: rule 2 makes protein a floor to hit, not a band — and the floor is
  // the nutrition table's, for that day's weight row.
  const proteinAdherenceDays = weekEntries.filter(
    (e) => e.proteinG !== undefined && e.proteinG >= dailyTargets(dailyEntriesArray, settings, e.date).proteinG,
  ).length;

  // --- daily tick boxes: done vs planned this week ---
  const checks = dailyChecks.map((check) => {
    let planned = 0;
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const date = format(addDays(parseISO(start), i), 'yyyy-MM-dd');
      if (!check.days.includes(dayIdForDate(parseISO(date)))) continue;
      planned++;
      if (dailyEntries[date]?.checks?.[check.id]) done++;
    }
    return { id: check.id, label: check.label, done, planned };
  });
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
    checks,
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

/** Best qualifying set of an exercise across the given weeks, in its own unit. */
function bestInWeeks(
  sessionLogs: Record<string, SessionLog>,
  exercise: Exercise,
  weeks: number[],
): Best | null {
  return bestOf(
    bestBySession(sessionLogs, exercise, 'all')
      .filter((h) => weeks.includes(h.week))
      .map((h) => h.best),
  );
}

export function checkEndOfBlockTargets(input: {
  targetGroups: { id: string; label: string; items: string[] }[];
  program: Exercise[];
  sessionLogs: Record<string, SessionLog>;
  dailyEntries: Record<string, DailyEntry>;
  settings: Settings;
  /** Date the "current" weight target is evaluated as-of (caller supplies "today"). */
  asOfDate: string;
}): TargetCheckGroup[] {
  const { targetGroups, sessionLogs, dailyEntries, settings, asOfDate } = input;
  const currentWeightKg = rolling7Weight(Object.values(dailyEntries), asOfDate);

  /**
   * Did the peak-test best (weeks 9–10) match or beat the week-1 best? Read
   * with compareBests, so a weighted lift is judged on load first, then reps.
   */
  function peakBeatsWeek1(exerciseId: string): TargetStatus {
    const exercise = input.program.find((e) => e.id === exerciseId);
    if (!exercise) return 'unknown';
    const first = bestInWeeks(sessionLogs, exercise, [1]);
    const peak = bestInWeeks(sessionLogs, exercise, PEAK_TEST_WEEKS);
    if (!first || !peak) return 'unknown';
    return compareBests(peak, first) <= 0 ? 'met' : 'unmet';
  }

  function status(id: string, index: number): TargetStatus {
    // Body: "at target weight" — read from settings rather than a literal band,
    // so changing the goal in Settings changes what this checks.
    if (id === 'body' && index === 0) {
      if (currentWeightKg === null) return 'unknown';
      return currentWeightKg <= settings.targetWeightKg + 0.5 ? 'met' : 'unmet';
    }
    if (id === 'test') {
      const exerciseId = PEAK_TEST_EXERCISE_IDS[index];
      return exerciseId ? peakBeatsWeek1(exerciseId) : 'unknown';
    }
    return 'unknown';
  }

  return targetGroups.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map((item, index) => ({ item, status: status(group.id, index) })),
  }));
}
