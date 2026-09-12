// Stop-rule check, stagnation detector, one-variable rule, tendon guardrails —
// SPEC.md sections 6.6–6.8, 6.11.
import { setValue } from './performance';
import { weekRpeCap } from './phase';
import { bestQualifyingScore } from './scoring';
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

// v5.0: five headline skills, one per objective in SPEC-V5.0.md section 9.
// The long cardio session joins the four strength skills so the Progress
// screen shows every objective the block sets, not only the gym ones.
// Each must point at something still PRESCRIBED, or it can never gain a data point.
export const SKILLS: SkillDefinition[] = [
  { id: 'frontLever', label: 'Front lever', exerciseId: 'fl-hold-primary', ladderId: 'frontLever' },
  { id: 'hspu', label: 'HSPU', exerciseId: 'hspu-primary', ladderId: 'hspu' },
  { id: 'pullup', label: 'Weighted pull-up', exerciseId: 'ring-pullup' },
  { id: 'dip', label: 'Weighted ring dip', exerciseId: 'ring-dip' },
  { id: 'longCardio', label: 'Long cardio', exerciseId: 'sun-long-cardio' },
];

// ---------------------------------------------------------------------------
// 6.6 — Stop-rule check (live, during the session)
// ---------------------------------------------------------------------------
export type StopRuleSeverity = 'amber' | 'red';

export interface StopRuleResult {
  severity: StopRuleSeverity;
  message: string;
}

// The RPE ceiling now lives in phase.ts as weekRpeCap(week) — it is read
// directly off SPEC-V4.0.md's own weekly tables rather than inferred from a
// phase name, and v4.0 has no test week to exempt lifts from.


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
  /**
   * The FIRST working set of this exercise in this session — the baseline
   * SPEC-V4.0.md section 7's Performance Drop Rule measures against. Undefined
   * when the set being checked is itself the first.
   */
  firstSetThisSession: SetLog | undefined;
  week: number;
}

export function checkStopRule(ctx: StopRuleContext): StopRuleResult | null {
  const { exercise, set, previousSetThisExercise, firstSetThisSession, week } = ctx;
  const scale = exercise.rpeScale ?? 'strength';

  if (
    exercise.metric === 'attempts' &&
    set.techniqueFlags.includes('collapsed') &&
    previousSetThisExercise?.techniqueFlags.includes('collapsed')
  ) {
    return { severity: 'red', message: 'Two collapses. Stop balance work today.' };
  }

  // v4.0 Performance Drop Rule (SPEC-V4.0.md section 7). Measured WITHIN the
  // session against its own first working set, not against a rolling best from
  // previous weeks. The plan's point is that a session which decays by >15%
  // from where it started has already given you its useful work — that is a
  // fact about today, and comparing today's third set to a PR set three weeks
  // ago answered a different question.
  const value = setValue(exercise.metric, set);
  const baseline = firstSetThisSession ? setValue(exercise.metric, firstSetThisSession) : undefined;
  if (baseline !== undefined && baseline > 0 && value !== undefined && value < baseline * 0.85) {
    return {
      severity: 'amber',
      message: 'Down more than 15% from your first set. Remove the last set, reduce load, or regress the skill.',
    };
  }

  if (set.techniqueFlags.length > 0) {
    const flag = set.techniqueFlags[0];
    return { severity: 'amber', message: `${FLAG_LABEL[flag]}. ${quotedRule(exercise, flag)}` };
  }

  // The two rules below read the strength RPE table. A stretch held at RPE 7 or
  // an easy run at RPE 2 mean something else entirely on their own scales
  // (SPEC-V4.0.md section 1), so they are not judged here.
  if (scale !== 'strength') return null;

  if (set.rpe === 10) {
    return { severity: 'amber', message: "Failure adds fatigue you can't afford at this frequency." };
  }

  if (set.rpe !== undefined) {
    const cap = weekRpeCap(week);
    if (set.rpe > cap) {
      return { severity: 'amber', message: `Week ${week} prescribes nothing above RPE ${cap}.` };
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
          firstSetThisSession: i > 0 ? log.sets[0] : undefined,
          week: session.week,
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
// Retired ids stay in these sets: joint-volume warnings read historical logs,
// and a session logged under earlier programming still loaded the same joint.
// v4.0 ids are added alongside the v1–v3 ones rather than replacing them.
const ELBOW_EXERCISE_IDS = new Set([
  // v4.0
  'fl-hold-primary',
  'fl-row-banded',
  'fl-raise',
  'ring-pullup',
  'pullup-secondary',
  'incline-curl',
  'cable-curl',
  'cable-triceps-ext',
  'overhead-triceps-ext',
  // v5.0 additions
  'fl-hold-banded',
  'wall-curl',
  'hammer-curl',
  // v1–v3, retired
  'fl-hard-iso',
  'fl-row',
  'fl-secondary',
  'ring-curl',
  'ring-row',
  'face-pull',
]);

const SHOULDER_EXERCISE_IDS = new Set([
  // v4.0
  'hspu-primary',
  'hspu-secondary',
  'wall-hspu-negative',
  'ring-dip',
  'ring-dip-secondary',
  'incline-db-press',
  'lateral-raise',
  'lateral-raise-c',
  // v5.0 additions
  'rear-delt-fly',
  // v1–v3, retired
  'pike-hspu',
  'press-to-hs',
  'planche-lean',
  'ring-pushup',
  'wall-hspu',
  'wall-hspu-partial',
  'belly-wall-hspu-negative',
  'hs-balance-primary',
  'hs-balance-secondary',
]);

// v4.0: the joint a five-run week actually threatens. Calf/tibialis work sits
// here alongside the runs because it loads the same tendon.
const ACHILLES_EXERCISE_IDS = new Set([
  'tue-run-warmup',
  'tue-run-strides',
  'tue-threshold',
  'tue-run-cooldown',
  'wed-recovery-run',
  'thu-easy-run',
  'sat-easy-run',
  'sat-strides',
  'sun-long-run',
  'sun-long-run-finish',
  'calf-raise-b',
  'calf-raise-c',
  'tibialis-raise',
  // v5.0 additions — all three cardio sessions load the calf-Achilles chain
  'mon-moderate-cardio',
  'fri-hiit-warmup',
  'fri-hiit-intervals',
  'fri-hiit-cooldown',
  'sun-long-cardio',
  // v1–v3, retired
  'sprints',
  'easy-run',
  'optional-run',
]);

export type Joint = 'elbow' | 'shoulder' | 'achilles';

/** The Readiness field that reports irritation in a given joint. */
export function jointIrritation(joint: Joint, readiness: Readiness): number {
  switch (joint) {
    case 'elbow':
      return readiness.elbowIrritation;
    case 'shoulder':
      return readiness.shoulderIrritation;
    case 'achilles':
      return readiness.achillesIrritation;
  }
}

/**
 * Which readiness input a given exercise's fatigue shows up in. Not encoded on
 * Exercise in the data model, so resolved here from the exercise id.
 */
export function relevantJoint(exerciseId: string): Joint | null {
  if (ELBOW_EXERCISE_IDS.has(exerciseId)) return 'elbow';
  if (SHOULDER_EXERCISE_IDS.has(exerciseId)) return 'shoulder';
  if (ACHILLES_EXERCISE_IDS.has(exerciseId)) return 'achilles';
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
  const jointOk = joint === null || last3.every((r) => jointIrritation(joint, r) <= 1);
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
  if (phase === 'deload' || phase === 'consolidation') return null;

  if (!isHealthy(health)) {
    const reasons: string[] = [];
    const last3 = health.recentReadiness.slice(0, 3);
    if (last3.length < 3) reasons.push('not enough recent readiness check-ins');
    if (last3.some((r) => r.soreness > 2)) reasons.push('soreness above target');
    const joint = relevantJoint(exercise.id);
    if (joint && last3.some((r) => jointIrritation(joint, r) > 1)) {
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
