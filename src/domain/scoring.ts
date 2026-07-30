// Set score, session load, relative strength, Exercise Progress Index — SPEC.md sections 6.3–6.5.
import { effectiveLevelForSet } from './difficulty';
import type { Exercise, Ladder, SessionLog, SetLog } from './types';

/** SetLog.score must exist the moment a set is logged, then gets recomputed on
 * read with the real engine once bodyweight-at-date etc. are known. */
export function placeholderSetScore(set: Pick<SetLog, 'reps' | 'seconds' | 'attempts'>): number {
  if (set.attempts) return set.attempts.reduce((sum, seconds) => sum + seconds, 0);
  return set.reps ?? set.seconds ?? 0;
}

/** intensityFactor(effLevel) = 1 + 0.2 × effLevel */
export function intensityFactor(effLevel: number): number {
  return 1 + 0.2 * effLevel;
}

/**
 * Recomputes a set's score per SPEC.md 6.3. `bodyweightKg` should be the 7-day
 * rolling average as of the session date, falling back to settings.startWeightKg.
 * `distanceTime` (easy runs) has no scoring formula in the spec — treated like
 * `timeOnly` as completion-only, since neither is a scored skill exercise.
 */
export function computeSetScore(
  exercise: Exercise,
  ladder: Ladder | undefined,
  set: SetLog,
  bodyweightKg: number,
): number {
  const factor = intensityFactor(effectiveLevelForSet(exercise, ladder, set));
  switch (exercise.metric) {
    case 'hold':
      return (set.seconds ?? 0) * factor;
    case 'reps':
      return (set.reps ?? 0) * factor;
    case 'attempts':
      return (set.attempts ?? []).reduce((sum, s) => sum + s, 0) * factor;
    case 'weightedReps': {
      if (!bodyweightKg) return 0;
      return (set.reps ?? 0) * ((bodyweightKg + (set.addedKg ?? 0)) / bodyweightKg) * factor;
    }
    case 'sprint': {
      // Per-set decomposition of "totalMetres × (avgIntensityPct/100)²": one set
      // is one rep, so this formula applied per rep and summed across the
      // session's sets reduces to the spec's exercise-level total when intensity
      // is constant across reps, and degrades gracefully otherwise.
      const pct = (set.intensityPct ?? 0) / 100;
      return (set.distanceM ?? 0) * pct * pct;
    }
    case 'timeOnly':
    case 'distanceTime':
      return 0;
  }
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

/** A set excluded from PR/baseline calculation: any technique flag, or RPE 10. */
export function isQualifyingSet(set: SetLog): boolean {
  return set.techniqueFlags.length === 0 && set.rpe !== 10;
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

function lastNSessionDates(history: DatedSetScore[], n: number): Set<string> {
  const dates = Array.from(new Set(history.map((r) => r.date))).sort();
  return new Set(dates.slice(-n));
}

/** baseline = best qualifying set score across weeks 1–2. */
export function exerciseBaseline(history: DatedSetScore[]): number | null {
  return bestQualifyingScore(history.filter((r) => r.week <= 2));
}

/** current = best qualifying set score across the last n (default 3) sessions of this exercise. */
export function exerciseCurrent(history: DatedSetScore[], n = 3): number | null {
  const dates = lastNSessionDates(history, n);
  return bestQualifyingScore(history.filter((r) => dates.has(r.date)));
}

/** progressIndex = current / baseline × 100 (week 1–2 = 100). Null if not enough data. */
export function exerciseProgressIndex(history: DatedSetScore[]): number | null {
  const baseline = exerciseBaseline(history);
  const current = exerciseCurrent(history);
  if (baseline === null || current === null || baseline === 0) return null;
  return (current / baseline) * 100;
}

/** The raw reps/seconds value SPEC.md 6.6's "≥15% below rolling best" compares against. */
function rawMetricValue(set: SetLog, metric: Exercise['metric']): number | undefined {
  if (metric === 'hold' || metric === 'attempts') return set.seconds;
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
