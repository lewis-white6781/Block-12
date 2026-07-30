// Autoregulation, joint-irritation volume warnings, optional-second-run gate —
// SPEC.md sections 6.9 (gate), 6.10.
import { program } from '../data/program';
import { bestQualifyingScore, computeSetScore, exerciseSessionBest } from './scoring';
import type { DayId, Readiness, SessionLog } from './types';

// ---------------------------------------------------------------------------
// 6.10 — Autoregulation
// ---------------------------------------------------------------------------

/** sleep < 6h or soreness = 3 → drop every target RPE by 0.5 this session. */
export function autoregulationAdjustment(readiness: Readiness): { rpeDelta: number; message: string } | null {
  if (readiness.sleepHours < 6 || readiness.soreness === 3) {
    return { rpeDelta: -0.5, message: 'Adjusted for recovery' };
  }
  return null;
}

const ELBOW_VOLUME_EXERCISE_IDS = ['fl-hard-iso', 'fl-row', 'ring-curl'];
const SHOULDER_VOLUME_EXERCISE_IDS = ['ring-dip', 'planche-lean', 'ring-pushup'];

export interface JointVolumeWarning {
  message: string;
  suggestedExerciseIds: string[];
}

/**
 * `readiness.ts` only models one soreness axis per joint (no distinct
 * calf/Achilles field on `Readiness`) — elbow/shoulder irritation are used
 * directly per SPEC.md 6.10's own field names.
 */
function twoConsecutiveAtOrAbove(recentReadiness: Readiness[], value: (r: Readiness) => number, threshold: number): boolean {
  return recentReadiness.length >= 2 && recentReadiness.slice(0, 2).every((r) => value(r) >= threshold);
}

/**
 * `recentReadiness` is this exercise day's session plus the one before it,
 * most-recent-first (i.e. the last two check-ins as of today).
 */
export function elbowVolumeWarning(recentReadiness: Readiness[]): JointVolumeWarning | null {
  if (!twoConsecutiveAtOrAbove(recentReadiness, (r) => r.elbowIrritation, 2)) return null;
  return {
    message: 'Reduce lever and curl volume this session.',
    suggestedExerciseIds: ELBOW_VOLUME_EXERCISE_IDS,
  };
}

export function shoulderVolumeWarning(recentReadiness: Readiness[]): JointVolumeWarning | null {
  if (!twoConsecutiveAtOrAbove(recentReadiness, (r) => r.shoulderIrritation, 2)) return null;
  return {
    message: 'Reduce pressing volume this session.',
    suggestedExerciseIds: SHOULDER_VOLUME_EXERCISE_IDS,
  };
}

// ---------------------------------------------------------------------------
// 6.9 — Optional second run gate
// ---------------------------------------------------------------------------

export interface OptionalRunCondition {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface OptionalRunGateResult {
  eligible: boolean;
  conditions: OptionalRunCondition[];
}

function sprintCondition(sessionLogs: Record<string, SessionLog>): OptionalRunCondition {
  const label = 'Wednesday sprints within 5% of recent best';
  const exercise = program.find((e) => e.id === 'sprints');
  if (!exercise) return { id: 'sprint', label, met: false, detail: 'Sprint exercise not found.' };

  const wedSessions = Object.values(sessionLogs)
    .filter((s) => s.day === 'wed' && s.block === 'main' && s.exercises.some((e) => e.exerciseId === 'sprints'))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (wedSessions.length === 0) {
    return { id: 'sprint', label, met: false, detail: 'No Wednesday sprint session logged yet.' };
  }

  const scoreForSession = (s: SessionLog) =>
    exerciseSessionBest(s, 'sprints', (set) => computeSetScore(exercise, undefined, set, 0));

  const latest = wedSessions[wedSessions.length - 1];
  const latestScore = scoreForSession(latest);
  if (latestScore === null) {
    return { id: 'sprint', label, met: false, detail: 'Latest Wednesday sprint session has no qualifying sets.' };
  }

  const priorScores = wedSessions
    .slice(Math.max(0, wedSessions.length - 4), wedSessions.length - 1)
    .map(scoreForSession)
    .filter((v): v is number => v !== null);
  if (priorScores.length === 0) {
    return { id: 'sprint', label, met: false, detail: 'Not enough sprint history yet.' };
  }

  const priorBest = Math.max(...priorScores);
  const met = priorBest > 0 && latestScore >= priorBest * 0.95;
  return {
    id: 'sprint',
    label,
    met,
    detail: `Latest ${latestScore.toFixed(0)} vs recent best ${priorBest.toFixed(0)}.`,
  };
}

function calfSorenessCondition(recentReadiness: Readiness[]): OptionalRunCondition {
  const label = 'Calf/Achilles soreness ≤1, last two check-ins';
  const last2 = recentReadiness.slice(0, 2);
  if (last2.length < 2) {
    return { id: 'calf', label, met: false, detail: 'Not enough recent readiness check-ins.' };
  }
  const met = last2.every((r) => r.soreness <= 1);
  return { id: 'calf', label, met, detail: `Soreness: ${last2.map((r) => r.soreness).join(', ')}.` };
}

function weeklyRateCondition(weeklyRatePct: number | null): OptionalRunCondition {
  const label = '|Weekly weight-change rate| ≤0.6%';
  if (weeklyRatePct === null) return { id: 'rate', label, met: false, detail: 'Not enough weight history yet.' };
  const met = Math.abs(weeklyRatePct) <= 0.6;
  return { id: 'rate', label, met, detail: `${weeklyRatePct.toFixed(2)}%/wk.` };
}

function sleepAndMotivationCondition(recentReadiness: Readiness[]): OptionalRunCondition {
  const label = 'Mean sleep (last 3 nights) ≥7h and motivation ≥2';
  const last3 = recentReadiness.slice(0, 3);
  if (last3.length < 3) {
    return { id: 'sleep', label, met: false, detail: 'Not enough recent readiness check-ins.' };
  }
  const meanSleep = last3.reduce((sum, r) => sum + r.sleepHours, 0) / last3.length;
  const motivation = last3[0].motivation;
  const met = meanSleep >= 7 && motivation >= 2;
  return { id: 'sleep', label, met, detail: `Sleep ${meanSleep.toFixed(1)}h, motivation ${motivation}.` };
}

/**
 * All four conditions must hold, and only from week 3 onward (SPEC.md 6.9).
 * `recentReadiness` is main-session check-ins, most-recent-first.
 */
export function optionalRunGate(params: {
  week: number;
  sessionLogs: Record<string, SessionLog>;
  recentReadiness: Readiness[];
  weeklyRatePct: number | null;
}): OptionalRunGateResult {
  const conditions = [
    sprintCondition(params.sessionLogs),
    calfSorenessCondition(params.recentReadiness),
    weeklyRateCondition(params.weeklyRatePct),
    sleepAndMotivationCondition(params.recentReadiness),
  ];
  const eligible = params.week >= 3 && conditions.every((c) => c.met);
  return { eligible, conditions };
}

/** Elbow banner day: SPEC.md 6.10 names Tuesday/Friday (the lever/curl days). */
export function isElbowWarningDay(day: DayId): boolean {
  return day === 'tue' || day === 'fri';
}

/** Shoulder banner day: the pressing days that carry ring-dip/planche-lean/ring-pushup. */
export function isShoulderWarningDay(day: DayId): boolean {
  return day === 'mon' || day === 'sat';
}
