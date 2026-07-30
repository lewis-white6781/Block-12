// Set score, session load, relative strength, Exercise Progress Index — SPEC.md sections 6.3–6.5.
// The formulas (intensityFactor, effectiveLevel-based scoring) land in a later prompt.
//
// SetLog.score must exist the moment a set is logged (it's a required field), and the
// type comment says it is "computed at write time AND recomputed on read" — so a rough
// placeholder now, superseded once the real engine lands, is expected behaviour, not a gap.
import type { SetLog } from './types';

export function placeholderSetScore(set: Pick<SetLog, 'reps' | 'seconds' | 'attempts'>): number {
  if (set.attempts) return set.attempts.reduce((sum, seconds) => sum + seconds, 0);
  return set.reps ?? set.seconds ?? 0;
}
