// Stop-rule check, stagnation detector, one-variable rule, tendon guardrails —
// SPEC.md sections 6.6–6.8, 6.11.
import { bestQualifyingScore, exerciseRollingBestRaw } from './scoring';
import type { DatedSetScore } from './scoring';
import type { Exercise, Ladder, Phase, ProgressionEvent, Readiness, SessionLog, SetLog, TechniqueFlag } from './types';

// ---------------------------------------------------------------------------
// Shared skill definitions — the four headline skills (SPEC.md 7.3) are also
// "the four test lifts" that run uncapped in the test-week RPE table (6.6).
// ---------------------------------------------------------------------------
export interface SkillDefinition {
  id: string;
  label: string;
  exerciseId: string;
  ladderId?: string;
}

export const SKILLS: SkillDefinition[] = [
  { id: 'frontLever', label: 'Front lever', exerciseId: 'fl-hard-iso', ladderId: 'frontLever' },
  // v3.0: was `hs-balance-primary` on the handstandEntry ladder. That exercise
  // is retired (SPEC-V3.0.md section 3), and a headline skill must point at
  // something still prescribed or it can never gain a new data point. Monday's
  // new slot 1 is the natural successor: same day, same slot, same skill, and
  // it sits on the hspu ladder that the label already named.
  { id: 'hspu', label: 'HSPU/handstand', exerciseId: 'wall-hspu-partial', ladderId: 'hspu' },
  { id: 'pistol', label: 'Pistol', exerciseId: 'pistol', ladderId: 'pistol' },
  { id: 'pullup', label: 'Pull-up', exerciseId: 'ring-pullup' },
];

const TEST_LIFT_IDS = new Set(SKILLS.map((s) => s.exerciseId));

// ---------------------------------------------------------------------------
// 6.6 — Stop-rule check (live, during the session)
// ---------------------------------------------------------------------------
export type StopRuleSeverity = 'amber' | 'red';

export interface StopRuleResult {
  severity: StopRuleSeverity;
  message: string;
}

/**
 * Phase RPE caps (SPEC.md 6.6). "Accumulation 9 (accessories only)" can't be
 * distinguished from skill lifts — program.ts carries no accessory/skill
 * marker — so the cap is applied uniformly across accumulation. Test week is
 * uncapped only for the four test lifts (SKILLS above), capped 7 otherwise.
 */
export function phaseRpeCap(phase: Phase, exerciseId: string): number {
  switch (phase) {
    case 'calibration':
      return 7.5;
    case 'accumulation':
      return 9;
    case 'deload':
      return 6;
    case 'intensification':
      return 8.5;
    case 'peak':
      return 8.5;
    case 'taper':
      return 7.5;
    case 'test':
      return TEST_LIFT_IDS.has(exerciseId) ? Infinity : 7;
  }
}

const FLAG_LABEL: Record<TechniqueFlag, string> = {
  hipsSagged: 'Hips sagged',
  elbowsUnlocked: 'Elbows unlocked',
  lineChanged: 'Line changed',
  usedMomentum: 'Used momentum',
  partialROM: 'Partial ROM',
  collapsed: 'Collapsed',
  assistedExtra: 'Extra assistance used',
};

const FLAG_KEYWORDS: Record<TechniqueFlag, string[]> = {
  hipsSagged: ['hips sag'],
  elbowsUnlocked: ['elbows unlock'],
  lineChanged: ['line changed', 'line'],
  usedMomentum: ['momentum'],
  partialROM: ['rom', 'partial'],
  collapsed: ['collapse'],
  assistedExtra: ['assist'],
};

const UNIVERSAL_STOP_RULE =
  'Plan rule: stop a skill exercise when hold time or reps drop more than ~15%, hips sag, elbows unlock, the line changes substantially, you need momentum, or two consecutive handstand attempts collapse immediately.';

function quotedRule(exercise: Exercise, flag: TechniqueFlag): string {
  const keywords = FLAG_KEYWORDS[flag];
  const match = exercise.stopRules.find((rule) => keywords.some((kw) => rule.toLowerCase().includes(kw)));
  return match ? `Plan rule: "${match}."` : UNIVERSAL_STOP_RULE;
}

export interface StopRuleContext {
  exercise: Exercise;
  /** The set just logged, to evaluate. */
  set: SetLog;
  /** The set logged immediately before it in this session (for consecutive-collapse detection). */
  previousSetThisExercise: SetLog | undefined;
  /** Best qualifying raw reps/seconds for this exercise across its last 3 prior sessions. */
  rollingBestRaw: number | null;
  week: number;
  phase: Phase;
}

export function checkStopRule(ctx: StopRuleContext): StopRuleResult | null {
  const { exercise, set, previousSetThisExercise, rollingBestRaw, week, phase } = ctx;

  if (
    exercise.metric === 'attempts' &&
    set.techniqueFlags.includes('collapsed') &&
    previousSetThisExercise?.techniqueFlags.includes('collapsed')
  ) {
    return { severity: 'red', message: 'Two collapses. Stop balance work today.' };
  }

  const raw =
    exercise.metric === 'hold' || exercise.metric === 'attempts' || exercise.metric === 'timeOnly'
      ? set.seconds
      : set.reps;
  if (rollingBestRaw !== null && rollingBestRaw > 0 && raw !== undefined && raw <= rollingBestRaw * 0.85) {
    return { severity: 'amber', message: 'Quality drop. Plan says end this exercise.' };
  }

  if (set.techniqueFlags.length > 0) {
    const flag = set.techniqueFlags[0];
    return { severity: 'amber', message: `${FLAG_LABEL[flag]}. ${quotedRule(exercise, flag)}` };
  }

  if (set.rpe === 10 && week !== 10 && week !== 12) {
    return { severity: 'amber', message: "Failure adds fatigue you can't afford at this frequency." };
  }

  if ((phase === 'deload' || phase === 'taper') && set.rpe !== undefined) {
    const cap = phaseRpeCap(phase, exercise.id);
    if (set.rpe > cap) {
      return { severity: 'amber', message: `Week ${week} caps at RPE ${cap}.` };
    }
  }

  return null;
}

/**
 * StopRuleBanner firings aren't persisted (they're computed live in the
 * Runner) — Review needs them retrospectively, so this re-runs the same
 * predicate over every set logged in the given week, in logged order.
 */
export function weeklyStopRuleFirings(
  sessionLogs: Record<string, SessionLog>,
  exercises: Exercise[],
  week: number,
): { exerciseId: string; result: StopRuleResult }[] {
  const firings: { exerciseId: string; result: StopRuleResult }[] = [];
  const weekSessions = Object.values(sessionLogs)
    .filter((s) => s.week === week)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const session of weekSessions) {
    for (const log of session.exercises) {
      const exercise = exercises.find((e) => e.id === log.exerciseId);
      if (!exercise) continue;
      for (let i = 0; i < log.sets.length; i++) {
        const result = checkStopRule({
          exercise,
          set: log.sets[i],
          previousSetThisExercise: i > 0 ? log.sets[i - 1] : undefined,
          rollingBestRaw: exerciseRollingBestRaw(sessionLogs, exercise.id, exercise.metric, session.id),
          week: session.week,
          phase: session.phase,
        });
        if (result) firings.push({ exerciseId: exercise.id, result });
      }
    }
  }
  return firings;
}

// ---------------------------------------------------------------------------
// 6.7 — Stagnation detector
// ---------------------------------------------------------------------------

/**
 * Which readiness input a given exercise's fatigue shows up in. Not encoded on
 * Exercise in the data model, so inferred here from exercise id / ladder —
 * elbow-loaded pulling and lever work vs shoulder-loaded pressing work.
 */
const ELBOW_EXERCISE_IDS = new Set([
  'fl-hard-iso',
  'fl-row',
  'fl-raise',
  'fl-secondary',
  'ring-curl',
  'ring-pullup',
  'ring-row',
  'face-pull',
]);
// Retired ids stay in this set: joint-volume warnings read historical logs, and
// a Monday logged before v3.0 still loaded the same shoulders (SPEC-V3.0.md
// section 3). The two v3.0 replacements are added alongside them.
const SHOULDER_EXERCISE_IDS = new Set([
  'pike-hspu',
  'press-to-hs',
  'ring-dip',
  'planche-lean',
  'ring-pushup',
  'wall-hspu',
  'wall-hspu-partial',
  'belly-wall-hspu-negative',
  'hs-balance-primary',
  'hs-balance-secondary',
]);

function relevantJoint(exerciseId: string): 'elbow' | 'shoulder' | null {
  if (ELBOW_EXERCISE_IDS.has(exerciseId)) return 'elbow';
  if (SHOULDER_EXERCISE_IDS.has(exerciseId)) return 'shoulder';
  return null;
}

/** flat = the best of the last 3 sessions has not beaten the prior best by >=3%. */
export function isFlat(history: DatedSetScore[]): boolean {
  const dates = Array.from(new Set(history.map((r) => r.date))).sort();
  if (dates.length < 4) return false;
  const recentDates = new Set(dates.slice(-3));
  const priorDates = new Set(dates.slice(0, -3));
  const recentBest = bestQualifyingScore(history.filter((r) => recentDates.has(r.date)));
  const priorBest = bestQualifyingScore(history.filter((r) => priorDates.has(r.date)));
  if (recentBest === null || priorBest === null || priorBest === 0) return false;
  return recentBest < priorBest * 1.03;
}

export interface HealthCheckInput {
  exerciseId: string;
  /** Most recent readiness check-ins, most-recent-first. */
  recentReadiness: Readiness[];
  daysWithLoggedWeightInLast7: number;
}

export function isHealthy(input: HealthCheckInput): boolean {
  if (input.recentReadiness.length < 3) return false;
  const last3 = input.recentReadiness.slice(0, 3);
  const soreOk = last3.every((r) => r.soreness <= 2);
  const joint = relevantJoint(input.exerciseId);
  const jointOk =
    joint === null || last3.every((r) => (joint === 'elbow' ? r.elbowIrritation : r.shoulderIrritation) <= 1);
  const weightOk = input.daysWithLoggedWeightInLast7 >= 5;
  return soreOk && jointOk && weightOk;
}

/** Next unused axis in the exercise's progressionLadder, based on logged ProgressionEvents. */
export function nextProgressionAxis(exercise: Exercise, events: ProgressionEvent[]): string | null {
  const used = new Set(events.filter((e) => e.exerciseId === exercise.id).map((e) => e.axis));
  return exercise.progressionLadder.find((axis) => !used.has(axis)) ?? null;
}

export interface StagnationResult {
  exerciseId: string;
  type: 'stagnant' | 'recovery';
  message: string;
  suggestedAxis?: string;
  outOfRangeReasons?: string[];
}

export function detectStagnation(params: {
  exercise: Exercise;
  history: DatedSetScore[];
  health: HealthCheckInput;
  phase: Phase;
  progressionEvents: ProgressionEvent[];
}): StagnationResult | null {
  const { exercise, history, health, phase, progressionEvents } = params;

  if (!isFlat(history)) return null;
  if (phase === 'deload' || phase === 'taper') return null;

  if (!isHealthy(health)) {
    const reasons: string[] = [];
    const last3 = health.recentReadiness.slice(0, 3);
    if (last3.length < 3) reasons.push('not enough recent readiness check-ins');
    if (last3.some((r) => r.soreness > 2)) reasons.push('soreness above target');
    const joint = relevantJoint(exercise.id);
    if (joint && last3.some((r) => (joint === 'elbow' ? r.elbowIrritation : r.shoulderIrritation) > 1)) {
      reasons.push(`${joint} irritation above target`);
    }
    if (health.daysWithLoggedWeightInLast7 < 5) reasons.push('weight not logged consistently');
    return {
      exerciseId: exercise.id,
      type: 'recovery',
      message: 'Flat, but recovery is the likely cause.',
      outOfRangeReasons: reasons,
    };
  }

  const axis = nextProgressionAxis(exercise, progressionEvents);
  return {
    exerciseId: exercise.id,
    type: 'stagnant',
    message: axis
      ? `${exercise.name} has been flat for 3 sessions. Next lever on your ladder: ${axis}.`
      : `${exercise.name} has been flat for 3 sessions.`,
    suggestedAxis: axis ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// 6.8 — One-variable rule
// ---------------------------------------------------------------------------

/** True if any other ProgressionEvent exists for this exercise in this week. */
export function hasProgressionEventThisWeek(
  events: ProgressionEvent[],
  exerciseId: string,
  week: number,
  weekOfDate: (date: string) => number,
): boolean {
  return events.some((e) => e.exerciseId === exerciseId && weekOfDate(e.date) === week);
}

export function oneVariableWarning(
  events: ProgressionEvent[],
  exerciseId: string,
  week: number,
  weekOfDate: (date: string) => number,
): string | null {
  const priorEvent = events.find((e) => e.exerciseId === exerciseId && weekOfDate(e.date) === week);
  if (!priorEvent) return null;
  return `You already changed ${priorEvent.axis} on this exercise this week. Changing two variables at once makes the result uninterpretable. Log it anyway?`;
}

/**
 * Every ProgressionEvent beyond the first, per exercise, within the given
 * week — i.e. every event that could only have been logged by overriding the
 * one-variable-rule warning. "Fired flags... counts overrides" per SPEC.md 6.8.
 */
export function oneVariableOverrideCount(
  events: ProgressionEvent[],
  weekOfDate: (date: string) => number,
  week: number,
): number {
  const countByExercise = new Map<string, number>();
  for (const event of events) {
    if (weekOfDate(event.date) !== week) continue;
    countByExercise.set(event.exerciseId, (countByExercise.get(event.exerciseId) ?? 0) + 1);
  }
  let overrides = 0;
  for (const count of countByExercise.values()) overrides += Math.max(0, count - 1);
  return overrides;
}

// ---------------------------------------------------------------------------
// 6.11 — Tendon guardrails (surfaced in Review)
// ---------------------------------------------------------------------------
export interface GuardrailFiring {
  message: string;
}

/** Exercise churn: a tracked main exercise changed variant more than twice in 3 weeks. */
export function churnGuardrails(
  events: ProgressionEvent[],
  exercises: Exercise[],
  weekOfDate: (date: string) => number,
  throughWeek: number,
): GuardrailFiring[] {
  const results: GuardrailFiring[] = [];
  const byExercise = new Map<string, ProgressionEvent[]>();
  for (const event of events) {
    const list = byExercise.get(event.exerciseId) ?? [];
    list.push(event);
    byExercise.set(event.exerciseId, list);
  }
  const windowStart = throughWeek - 2;
  for (const [exerciseId, evts] of byExercise) {
    const count = evts.filter((e) => {
      const w = weekOfDate(e.date);
      return w >= windowStart && w <= throughWeek;
    }).length;
    if (count > 2) {
      const exercise = exercises.find((x) => x.id === exerciseId);
      results.push({
        message: `${exercise?.name ?? exerciseId}: you're changing exercises too often for tendon adaptation.`,
      });
    }
  }
  return results;
}

/** Leverage jump: a ProgressionEvent moving effective level by > 1.0 in one step. */
export function leverageJumpGuardrails(
  events: ProgressionEvent[],
  exercises: Exercise[],
  ladders: Ladder[],
): GuardrailFiring[] {
  const results: GuardrailFiring[] = [];
  for (const event of events) {
    const exercise = exercises.find((x) => x.id === event.exerciseId);
    const ladder = exercise?.ladderId ? ladders.find((l) => l.id === exercise.ladderId) : undefined;
    if (!ladder) continue;
    const from = ladder.variants.find((v) => v.id === event.from)?.level;
    const to = ladder.variants.find((v) => v.id === event.to)?.level;
    if (from === undefined || to === undefined) continue;
    if (Math.abs(to - from) > 1.0) {
      results.push({ message: `${exercise?.name}: sudden leverage jump. Step back half a level.` });
    }
  }
  return results;
}

/** Collapse training: >= 2 'collapsed' flags on lever holds in one week. */
export function collapseTrainingGuardrails(
  sessionLogs: Record<string, SessionLog>,
  exercises: Exercise[],
  week: number,
): GuardrailFiring[] {
  const leverExerciseIds = new Set(
    exercises.filter((e) => e.ladderId === 'frontLever' && e.metric === 'hold').map((e) => e.id),
  );
  let count = 0;
  for (const session of Object.values(sessionLogs)) {
    if (session.week !== week) continue;
    for (const log of session.exercises) {
      if (!leverExerciseIds.has(log.exerciseId)) continue;
      count += log.sets.filter((s) => s.techniqueFlags.includes('collapsed')).length;
    }
  }
  return count >= 2 ? [{ message: 'Lever holds are being trained to collapse.' }] : [];
}
