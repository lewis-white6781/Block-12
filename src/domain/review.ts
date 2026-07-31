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
import { corridorStatus, rolling7Calories, rolling7Weight, weeklyRateKg } from './body';
import type { CorridorStatus } from './body';
import { dayIdForDate, phaseForWeek } from './phase';
import { buildExerciseHistory, computeSetScore, exerciseProgressIndex, isQualifyingSet } from './scoring';
import type {
  BenchmarkEntry,
  DailyEntry,
  Exercise,
  Ladder,
  Phase,
  ProgressionEvent,
  Readiness,
  SessionLog,
  Settings,
} from './types';

// SPEC.md 7.6: "Sessions completed vs planned (5 main + 7 AM)" — the fixed
// weekly totals stated in the spec (Thursday has no main session; every day
// including Sunday carries an AM block).
const SESSIONS_PLANNED = { main: 5, am: 7 };

export const PHASE_NOTES: Record<Phase, string> = {
  calibration: 'Establish clean baseline numbers on every exercise — this is what everything else is measured against.',
  accumulation: 'Volume phase. Most of the block\'s work happens here; RPE caps at 9 for accessories.',
  deload: 'Half volume, easy RPE (cap 6). Let tendons and CNS catch up before intensification.',
  intensification: 'Lower volume, higher intensity. Sets get harder, not longer. RPE caps at 8.5.',
  peak: 'Highest-quality work of the block, immediately before the taper. RPE caps at 8.5.',
  taper: 'Cut volume, keep intensity low (cap 7.5), arrive fresh for week 12 testing.',
  test: 'Test week. The four skill lifts run uncapped; everything else caps at RPE 7.',
};

export interface WeeklyReview {
  week: number;
  phase: Phase;
  sessionsCompleted: { main: number; am: number };
  sessionsPlanned: { main: number; am: number };
  weight: {
    meanKg: number | null;
    rateKgPerWeek: number | null;
    status: CorridorStatus | null;
  };
  nutrition: {
    proteinAdherenceDays: number;
    meanCalories: number | null;
  };
  skillDeltas: {
    skill: (typeof SKILLS)[number];
    progressIndex: number | null;
    deltaVsLastWeek: number | null;
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

function bodyweightAt(dailyEntries: DailyEntry[], date: string, startWeightKg: number): number {
  return rolling7Weight(dailyEntries, date) ?? startWeightKg;
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

function daysWithLoggedWeight(dailyEntries: DailyEntry[], asOfDate: string): number {
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
  let mainCompleted = 0;
  let amCompleted = 0;
  for (let i = 0; i < 7; i++) {
    const date = format(addDays(parseISO(start), i), 'yyyy-MM-dd');
    const dayId = dayIdForDate(parseISO(date));
    const exercisesForDay = program.filter((e) => e.day === dayId);
    if (sessionLogs[`${date}:main`]?.completedAt) mainCompleted++;
    if (isAmDayComplete(sessionLogs[`${date}:am`], exercisesForDay)) amCompleted++;
  }

  // --- weight & nutrition ---
  const meanKg = rolling7Weight(dailyEntriesArray, end);
  const rateKg = weeklyRateKg(dailyEntriesArray, end);
  const weekEntries = dailyEntriesArray.filter((e) => e.date >= start && e.date <= end);
  const proteinAdherenceDays = weekEntries.filter(
    (e) =>
      e.proteinG !== undefined && e.proteinG >= settings.proteinTargetLow && e.proteinG <= settings.proteinTargetHigh,
  ).length;
  const meanCalories = rolling7Calories(dailyEntriesArray, end);

  // --- per-skill Progress Index + weekly delta ---
  const scoreForSet = (exercise: Exercise, ladder: Ladder | undefined) => (set: Parameters<typeof computeSetScore>[2], date: string) =>
    computeSetScore(exercise, ladder, set, bodyweightAt(dailyEntriesArray, date, settings.startWeightKg));

  const skillDeltas = SKILLS.map((skill) => {
    const exercise = program.find((e) => e.id === skill.exerciseId);
    if (!exercise) return { skill, progressIndex: null, deltaVsLastWeek: null };
    const ladder = exercise.ladderId ? ladders.find((l) => l.id === exercise.ladderId) : undefined;
    const history = buildExerciseHistory(sessionLogs, exercise.id, scoreForSet(exercise, ladder));
    const thisWeek = exerciseProgressIndex(history.filter((r) => r.date <= end));
    const priorWeekEnd = format(addDays(parseISO(end), -7), 'yyyy-MM-dd');
    const lastWeek = exerciseProgressIndex(history.filter((r) => r.date <= priorWeekEnd));
    return {
      skill,
      progressIndex: thisWeek,
      deltaVsLastWeek: thisWeek !== null && lastWeek !== null ? thisWeek - lastWeek : null,
    };
  });

  // --- fired flags ---
  const trackedMainExercises = program.filter((e) => e.block === 'main' && e.tracked);
  const stagnation: StagnationResult[] = [];
  for (const exercise of trackedMainExercises) {
    const ladder = exercise.ladderId ? ladders.find((l) => l.id === exercise.ladderId) : undefined;
    const history = buildExerciseHistory(sessionLogs, exercise.id, scoreForSet(exercise, ladder)).filter(
      (r) => r.date <= end,
    );
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
          const suggestions = trackedMainExercises
            .map((exercise) => {
              const ladder = exercise.ladderId ? ladders.find((l) => l.id === exercise.ladderId) : undefined;
              const history = buildExerciseHistory(sessionLogs, exercise.id, scoreForSet(exercise, ladder)).filter(
                (r) => r.date <= end,
              );
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
    sessionsCompleted: { main: mainCompleted, am: amCompleted },
    sessionsPlanned: SESSIONS_PLANNED,
    weight: { meanKg, rateKgPerWeek: rateKg, status: corridorStatus(rateKg) },
    nutrition: { proteinAdherenceDays, meanCalories },
    skillDeltas,
    firedFlags: { stagnation, guardrails, stopRules, oneVariableOverrides },
    nextWeek,
    benchmarkWeek: week === 1 || week === 6 || week === 12,
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
  benchmarkEntries: BenchmarkEntry[];
  settings: Settings;
  week12ProgressIndex: (exerciseId: string) => number | null;
  /** Date the "current" weight target is evaluated as-of (caller supplies "today"). */
  asOfDate: string;
}): TargetCheckGroup[] {
  const { targetGroups, sessionLogs, dailyEntries, benchmarkEntries, settings, asOfDate } = input;
  const dailyEntriesArray = Object.values(dailyEntries);
  const currentWeightKg = rolling7Weight(dailyEntriesArray, asOfDate);

  function status(id: string, index: number): TargetStatus {
    // Body: "72-73 kg"
    if (id === 'body' && index === 0) {
      if (currentWeightKg === null) return 'unknown';
      return currentWeightKg >= 72 && currentWeightKg <= 73 ? 'met' : 'unmet';
    }
    // Body: "dip and pull-up performance broadly maintained"
    if (id === 'body' && index === 3) {
      const dip = input.week12ProgressIndex('ring-dip');
      const pullup = input.week12ProgressIndex('ring-pullup');
      if (dip === null || pullup === null) return 'unknown';
      return dip >= 90 && pullup >= 90 ? 'met' : 'unmet';
    }
    // Front lever: "open advanced tuck 10-15s or one-leg 5-8s or noticeably less band assistance"
    if (id === 'frontLever' && index === 0) {
      const best = bestQualifyingSetInWeek(sessionLogs, 'fl-hard-iso', 12);
      if (!best) return 'unknown';
      if (best.variantId === 'open-advanced-tuck' && (best.seconds ?? 0) >= 10 && (best.seconds ?? 0) <= 15) return 'met';
      if (best.variantId === 'one-leg' && (best.seconds ?? 0) >= 5 && (best.seconds ?? 0) <= 8) return 'met';
      if ((best.assistanceTier ?? 0) === 0) return 'met';
      return 'unmet';
    }
    // HSPU/handstand: "consistent 8-15 s freestanding balances"
    if (id === 'handstandHspu' && index === 0) {
      const best = bestQualifyingSetInWeek(sessionLogs, 'hs-balance-primary', 12);
      if (!best) return 'unknown';
      if (best.variantId !== 'freestanding-kickup') return 'unknown';
      return (best.seconds ?? 0) >= 8 && (best.seconds ?? 0) <= 15 ? 'met' : 'unmet';
    }
    // HSPU/handstand: "first controlled full or near-full wall HSPU"
    if (id === 'handstandHspu' && index === 3) {
      if (!anyQualifyingSetInWeek(sessionLogs, 'wall-hspu', 12)) return 'unknown';
      return 'met';
    }
    // Pistol: "5-8 clean bodyweight reps/side or 3-5 weighted"
    if (id === 'pistol' && index === 0) {
      const best = bestQualifyingSetInWeek(sessionLogs, 'pistol', 12);
      if (!best) return 'unknown';
      if ((best.addedKg ?? 0) > 0) return (best.reps ?? 0) >= 3 && (best.reps ?? 0) <= 5 ? 'met' : 'unmet';
      return (best.reps ?? 0) >= 5 && (best.reps ?? 0) <= 8 ? 'met' : 'unmet';
    }
    // Mobility: "per §5.9 targets" — met if week-1 -> week-12 benchmarks with an
    // explicit target moved in the right direction by the stated amount.
    if (id === 'mobility' && index === 0) {
      const week1 = benchmarkEntries.find((b) => b.week === 1);
      const week12 = benchmarkEntries.find((b) => b.week === 12);
      if (!week1 || !week12) return 'unknown';
      const kneeDelta = (week12.values.kneeToWall ?? 0) - (week1.values.kneeToWall ?? 0);
      const pikeDelta = (week12.values.pikeReach ?? 0) - (week1.values.pikeReach ?? 0);
      if (week12.values.kneeToWall === undefined || week12.values.pikeReach === undefined) return 'unknown';
      return kneeDelta >= 2 && pikeDelta >= 5 ? 'met' : 'unmet';
    }
    // Cardio: "comfortable 50-55 min conversational run"
    if (id === 'cardio' && index === 0) {
      let bestMinutes: number | null = null;
      for (const session of Object.values(sessionLogs)) {
        const log = session.exercises.find((e) => e.exerciseId === 'easy-run');
        if (!log) continue;
        for (const set of log.sets) {
          if (!isQualifyingSet(set)) continue;
          if (bestMinutes === null || (set.reps ?? 0) > bestMinutes) bestMinutes = set.reps ?? 0;
        }
      }
      if (bestMinutes === null) return 'unknown';
      return bestMinutes >= 50 && bestMinutes <= 55 ? 'met' : 'unmet';
    }
    // Cardio: "no decline in pistol or sprint performance"
    if (id === 'cardio' && index === 2) {
      const pistol = input.week12ProgressIndex('pistol');
      const sprints = input.week12ProgressIndex('sprints');
      if (pistol === null || sprints === null) return 'unknown';
      return pistol >= 95 && sprints >= 95 ? 'met' : 'unmet';
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
