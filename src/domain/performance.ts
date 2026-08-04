// Plain performance model — SPEC-V3.0.md section 2. Replaces SPEC.md 6.2-6.5.
//
// The question this answers is "am I getting stronger at this movement?", and
// the honest answer is a number in the movement's own unit next to the same
// number from a few weeks ago. There are no multipliers here and no unitless
// indices: the Difficulty Index folded variant difficulty into what was
// presented as a performance number, so a variant change looked like progress
// and a genuine rep PR at an easier variant looked like regression.
//
// Variant and assistance are handled by GROUPING instead — see bestByVariant.
import { buildExerciseHistory, isQualifyingSet } from './scoring';
import type { DatedSetScore } from './scoring';
import type { Exercise, SessionLog, SetLog } from './types';

/** Fractional improvement below which two bests count as the same. SPEC.md 6.6. */
export const FLAT_THRESHOLD = 1.03;

export type BestKind = 'reps' | 'seconds' | 'weightedReps' | 'distance';

export interface Best {
  kind: BestKind;
  /** Reps, seconds, or metres — whatever the movement is actually measured in. */
  value: number;
  addedKg?: number;
  romCm?: number;
  variantId?: string;
  assistanceTier?: number;
  date: string;
  week: number;
}

/** Which raw number this exercise is measured in. */
export function bestKindFor(metric: Exercise['metric']): BestKind {
  switch (metric) {
    case 'hold':
    case 'timeOnly':
    case 'attempts':
      return 'seconds';
    case 'weightedReps':
      return 'weightedReps';
    case 'sprint':
      return 'distance';
    case 'reps':
    case 'distanceTime':
      return 'reps';
  }
}

/**
 * The raw logged number for a set, or undefined if the set carries none.
 * `attempts` reports the best single attempt rather than the sum: the sum
 * rewards taking more attempts, which is not the same as being better at it.
 */
export function setValue(metric: Exercise['metric'], set: SetLog): number | undefined {
  switch (bestKindFor(metric)) {
    case 'seconds':
      return set.attempts?.length ? Math.max(...set.attempts) : set.seconds;
    case 'distance':
      return set.distanceM;
    case 'reps':
    case 'weightedReps':
      return set.reps;
  }
}

/**
 * A single comparable number for a set, for the machinery that needs one
 * scalar (the stagnation detector, session load, SetLog.score).
 *
 * This is `setValue` with two additions: sprints keep SPEC.md 6.3's
 * `distance × (intensity%)²` formula, which is a real physical model rather
 * than a difficulty fudge and so survives v3.0 intact; and a set with no raw
 * value scores 0 instead of undefined.
 */
export function plainScore(metric: Exercise['metric'], set: SetLog): number {
  if (metric === 'sprint') {
    const pct = (set.intensityPct ?? 0) / 100;
    return (set.distanceM ?? 0) * pct * pct;
  }
  return setValue(metric, set) ?? 0;
}

/**
 * Every logged set for one exercise as a plain-scored history, oldest first —
 * the shape SPEC.md 6.6's stagnation detector consumes. Replaces the
 * `buildExerciseHistory(..., computeSetScore(...))` pairing, which needed a
 * bodyweight lookup threaded through every call site purely to feed a
 * multiplier that no longer exists.
 */
export function buildPlainHistory(
  sessionLogs: Record<string, SessionLog>,
  exercise: Exercise,
): DatedSetScore[] {
  return buildExerciseHistory(sessionLogs, exercise.id, (set) => plainScore(exercise.metric, set));
}

/**
 * Orders two sets of the same exercise, better first. Returns <0 if `a` is
 * better.
 *
 * For weighted movements LOAD is the primary axis and reps the tiebreak —
 * 1 rep at +25 kg beats 8 reps at +20 kg, which is how a weighted movement
 * actually progresses. For everything else the raw value leads.
 *
 * `romCm` breaks a final tie, and is the one comparison that INVERTS: lower
 * pad height means deeper, means better.
 */
export function compareBests(a: Best, b: Best): number {
  if (a.kind === 'weightedReps' || b.kind === 'weightedReps') {
    const loadDiff = (b.addedKg ?? 0) - (a.addedKg ?? 0);
    if (loadDiff !== 0) return loadDiff;
  }
  if (b.value !== a.value) return b.value - a.value;
  if (a.romCm !== undefined && b.romCm !== undefined && a.romCm !== b.romCm) {
    return a.romCm - b.romCm; // inverted on purpose
  }
  return 0;
}

function toBest(exercise: Exercise, set: SetLog, date: string, week: number): Best | null {
  const value = setValue(exercise.metric, set);
  if (value === undefined) return null;
  return {
    kind: bestKindFor(exercise.metric),
    value,
    addedKg: set.addedKg,
    romCm: set.romCm,
    variantId: set.variantId,
    assistanceTier: set.assistanceTier,
    date,
    week,
  };
}

/** Best qualifying set in a list, or null. Non-qualifying sets never become a best. */
export function bestOf(bests: Best[]): Best | null {
  if (bests.length === 0) return null;
  return bests.reduce((best, candidate) => (compareBests(candidate, best) < 0 ? candidate : best));
}

export interface SessionBest {
  date: string;
  week: number;
  best: Best;
}

/**
 * One best per session for this exercise, oldest first. Sessions where the
 * exercise was logged but nothing qualified are omitted entirely rather than
 * recorded as zero — a session of flagged sets is missing data, not a bad
 * result.
 */
export function bestBySession(
  sessionLogs: Record<string, SessionLog>,
  exercise: Exercise,
): SessionBest[] {
  const out: SessionBest[] = [];
  for (const session of Object.values(sessionLogs)) {
    const log = session.exercises.find((e) => e.exerciseId === exercise.id);
    if (!log) continue;
    const candidates = log.sets
      .filter(isQualifyingSet)
      .map((set) => toBest(exercise, set, session.date, session.week))
      .filter((b): b is Best => b !== null);
    const best = bestOf(candidates);
    if (best) out.push({ date: session.date, week: session.week, best });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Best per block week, for a "best by week" sparkline. Sparse by design. */
export function bestByWeek(history: SessionBest[]): (Best | null)[] {
  return Array.from({ length: 12 }, (_, i) =>
    bestOf(history.filter((h) => h.week === i + 1).map((h) => h.best)),
  );
}

/**
 * Bests grouped by `variantId:assistanceTier`.
 *
 * This is how variant difficulty is handled now: like is compared with like,
 * and a set at "light band" is never numerically weighed against a set at
 * "none". Moving between groups is already recorded as a ProgressionEvent,
 * which is a more legible place for that fact than a multiplier was.
 */
export function bestByVariant(history: SessionBest[]): Map<string, Best> {
  const out = new Map<string, Best>();
  for (const { best } of history) {
    const key = `${best.variantId ?? 'none'}:${best.assistanceTier ?? 0}`;
    const current = out.get(key);
    if (!current || compareBests(best, current) < 0) out.set(key, best);
  }
  return out;
}

export type Trend = 'up' | 'flat' | 'down';

/**
 * Best of the last 2 sessions against the best of the 3 before them.
 *
 * The +/-3% dead band is FLAT_THRESHOLD, the same constant SPEC.md 6.6's
 * stagnation rule uses — deliberately shared so the arrow shown on the
 * Progress screen and the stagnation warning can never contradict each other
 * about the same exercise. Null until there is something on both sides to
 * compare.
 */
export function trend(history: SessionBest[], recentN = 2, priorN = 3): Trend | null {
  if (history.length < recentN + 1) return null;
  const recent = history.slice(-recentN);
  const prior = history.slice(Math.max(0, history.length - recentN - priorN), history.length - recentN);
  if (prior.length === 0) return null;

  const recentBest = bestOf(recent.map((h) => h.best));
  const priorBest = bestOf(prior.map((h) => h.best));
  if (!recentBest || !priorBest || priorBest.value === 0) return null;

  // Compared on the raw value only. A load or depth change is a variant-style
  // change and belongs in bestByVariant, not in a same-axis trend arrow.
  if (recentBest.value >= priorBest.value * FLAT_THRESHOLD) return 'up';
  if (recentBest.value * FLAT_THRESHOLD <= priorBest.value) return 'down';
  return 'flat';
}

/** The best recorded on or before `date`, for "…and what it was 4 weeks ago". */
export function bestAsOf(history: SessionBest[], date: string): Best | null {
  return bestOf(history.filter((h) => h.date <= date).map((h) => h.best));
}

/** The best across the whole history. */
export function bestOverall(history: SessionBest[]): Best | null {
  return bestOf(history.map((h) => h.best));
}

const TREND_ARROW: Record<Trend, string> = { up: '↑', flat: '→', down: '↓' };

export function trendArrow(t: Trend | null): string {
  return t ? TREND_ARROW[t] : '';
}

/** e.g. "8 reps", "12 s", "6 reps @ +10 kg", "6 reps · 15 cm". Always kg — display units convert at the call site. */
export function formatBest(best: Best | null): string {
  if (!best) return '—';
  const head =
    best.kind === 'seconds'
      ? `${best.value} s`
      : best.kind === 'distance'
        ? `${best.value} m`
        : `${best.value} reps`;
  const load = best.addedKg ? ` @ +${best.addedKg} kg` : '';
  const rom = best.romCm !== undefined ? ` · ${best.romCm} cm` : '';
  return `${head}${load}${rom}`;
}
