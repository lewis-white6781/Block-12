// Session load, relative strength, qualifying-set rule — SPEC.md section 6.3,
// as amended by SPEC-V3.0.md section 2.
//
// The Difficulty Index (effectiveLevel), the intensity multiplier
// (1 + 0.2 × effLevel) and the Exercise Progress Index (current/baseline × 100)
// were deleted in v3.0. Variant difficulty is now a GROUPING key, not a
// coefficient — see src/domain/performance.ts. What remains here is the part
// that was never the problem: bodyweight-relative load, the qualifying-set
// rule, and the history/rolling-best plumbing.
import type { Exercise, SessionLog, SetLog } from './types';

/**
 * The plain comparable value written to SetLog.score at log time.
 *
 * `attempts` reports the BEST attempt, matching performance.ts's setValue.
 * It used to sum them, which rewarded taking more attempts rather than being
 * better at it, and left the CSV's score column disagreeing with the best
 * shown on screen for the same set.
 */
export function placeholderSetScore(set: Pick<SetLog, 'reps' | 'seconds' | 'attempts'>): number {
  if (set.attempts?.length) return Math.max(...set.attempts);
  return set.reps ?? set.seconds ?? 0;
}

/** For weightedReps exercises: bodyweight-normalised relative load and est. 1RM. */
export function relativeLoad(bodyweightKg: number, addedKg: number): number {
  if (!bodyweightKg) return 0;
  return (bodyweightKg + addedKg) / bodyweightKg;
}

/** est1RMrelative = relativeLoad × (1 + reps / 30) — Epley, bodyweight-normalised. */
export function est1RMrelative(bodyweightKg: number, addedKg: number, reps: number): number {
  return relativeLoad(bodyweightKg, addedKg) * (1 + reps / 30);
}

/**
 * A set excluded from PR/baseline calculation: any technique flag, RPE 10, or
 * no raw metric value at all. That last case covers v1.0's AM checklist
 * completion markers (`{ techniqueFlags: [], score: 0 }`, no reps/seconds/
 * attempts/distanceM) — pre-v1.1 data that must not silently become a
 * baseline or trigger stagnation now that AM is scored (SPEC-V1.1.md 2.4).
 */
export function isQualifyingSet(set: SetLog): boolean {
  const hasRawValue =
    set.reps !== undefined ||
    set.seconds !== undefined ||
    (set.attempts?.length ?? 0) > 0 ||
    set.distanceM !== undefined;
  return hasRawValue && set.techniqueFlags.length === 0 && set.rpe !== 10;
}

/** sessionLoad = Σ set scores (no exclusions — this is total work done). */
export function sessionLoad(
  session: SessionLog,
  scoreForSet: (exerciseId: string, set: SetLog) => number,
): number {
  return session.exercises.reduce(
    (sum, log) => sum + log.sets.reduce((s, set) => s + scoreForSet(log.exerciseId, set), 0),
    0,
  );
}

/** exerciseSessionBest = max qualifying set score in that session, or null if none qualify. */
export function exerciseSessionBest(
  session: SessionLog,
  exerciseId: string,
  scoreForSet: (set: SetLog) => number,
): number | null {
  const log = session.exercises.find((e) => e.exerciseId === exerciseId);
  if (!log) return null;
  const scores = log.sets.filter(isQualifyingSet).map(scoreForSet);
  return scores.length ? Math.max(...scores) : null;
}

export interface DatedSetScore {
  date: string;
  week: number;
  score: number;
  qualifies: boolean;
}

/**
 * Flattens every logged set for one exercise across all sessions, oldest
 * first. `scoreForSet` receives the session date too, since scoring
 * weightedReps sets needs the bodyweight rolling average as-of that date.
 */
export function buildExerciseHistory(
  sessionLogs: Record<string, SessionLog>,
  exerciseId: string,
  scoreForSet: (set: SetLog, date: string) => number,
): DatedSetScore[] {
  const rows: DatedSetScore[] = [];
  for (const session of Object.values(sessionLogs)) {
    const log = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!log) continue;
    for (const set of log.sets) {
      rows.push({
        date: session.date,
        week: session.week,
        score: scoreForSet(set, session.date),
        qualifies: isQualifyingSet(set),
      });
    }
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function bestQualifyingScore(rows: DatedSetScore[]): number | null {
  const qualifying = rows.filter((r) => r.qualifies);
  return qualifying.length ? Math.max(...qualifying.map((r) => r.score)) : null;
}

/** The raw reps/seconds value SPEC.md 6.6's "≥15% below rolling best" compares against. */
function rawMetricValue(set: SetLog, metric: Exercise['metric']): number | undefined {
  if (metric === 'hold' || metric === 'attempts' || metric === 'timeOnly') return set.seconds;
  if (metric === 'reps' || metric === 'weightedReps' || metric === 'distanceTime') return set.reps;
  return undefined;
}

/**
 * Best qualifying raw reps/seconds for this exercise across its last n sessions,
 * excluding the given (in-progress) session. Used live by the stop-rule check.
 */
export function exerciseRollingBestRaw(
  sessionLogs: Record<string, SessionLog>,
  exerciseId: string,
  metric: Exercise['metric'],
  excludeSessionId: string,
  n = 3,
): number | null {
  const sessions = Object.values(sessionLogs)
    .filter((s) => s.id !== excludeSessionId && s.exercises.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, n);

  const values: number[] = [];
  for (const session of sessions) {
    const log = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!log) continue;
    for (const set of log.sets) {
      if (!isQualifyingSet(set)) continue;
      const value = rawMetricValue(set, metric);
      if (value !== undefined) values.push(value);
    }
  }
  return values.length ? Math.max(...values) : null;
}
