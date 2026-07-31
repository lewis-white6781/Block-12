import { describe, expect, it } from 'vitest';
import {
  buildExerciseHistory,
  computeSetScore,
  est1RMrelative,
  exerciseBaseline,
  exerciseCurrent,
  exerciseProgressIndex,
  exerciseRollingBestRaw,
  exerciseSessionBest,
  intensityFactor,
  isQualifyingSet,
  placeholderSetScore,
  relativeLoad,
  sessionLoad,
} from '../scoring';
import type { Exercise, Ladder, SessionLog, SetLog } from '../types';

function set(overrides: Partial<SetLog> = {}): SetLog {
  return { id: 'x', techniqueFlags: [], score: 0, ...overrides };
}

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex1',
    name: 'Exercise',
    day: 'mon',
    block: 'main',
    order: 1,
    metric: 'reps',
    tracked: true,
    cues: [],
    progressionLadder: [],
    stopRules: [],
    prescriptions: [],
    ...overrides,
  };
}

function session(overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: 'id',
    date: '2026-01-01',
    week: 1,
    phase: 'calibration',
    day: 'mon',
    block: 'main',
    startedAt: '2026-01-01T08:00:00.000Z',
    exercises: [],
    ...overrides,
  };
}

describe('placeholderSetScore', () => {
  it('sums attempt seconds when attempts are present', () => {
    expect(placeholderSetScore({ attempts: [4, 6] })).toBe(10);
  });

  it('falls back to reps', () => {
    expect(placeholderSetScore({ reps: 5 })).toBe(5);
  });

  it('falls back to seconds when no reps', () => {
    expect(placeholderSetScore({ seconds: 8 })).toBe(8);
  });

  it('returns 0 when nothing is present', () => {
    expect(placeholderSetScore({})).toBe(0);
  });
});

describe('intensityFactor', () => {
  it('is 1 + 0.2 * effLevel', () => {
    expect(intensityFactor(0)).toBe(1);
    expect(intensityFactor(3)).toBeCloseTo(1.6, 5);
  });
});

describe('computeSetScore per metric', () => {
  it('hold: seconds * intensityFactor', () => {
    const ex = exercise({ metric: 'hold' });
    expect(computeSetScore(ex, undefined, set({ seconds: 10 }), 80)).toBe(10);
  });

  it('reps: reps * intensityFactor', () => {
    const ex = exercise({ metric: 'reps' });
    expect(computeSetScore(ex, undefined, set({ reps: 8 }), 80)).toBe(8);
  });

  it('attempts: sum(attemptSeconds) * intensityFactor', () => {
    const ex = exercise({ metric: 'attempts' });
    expect(computeSetScore(ex, undefined, set({ attempts: [4, 5] }), 80)).toBe(9);
  });

  it('weightedReps: reps * (bodyweight+added)/bodyweight * intensityFactor', () => {
    const ex = exercise({ metric: 'weightedReps' });
    const score = computeSetScore(ex, undefined, set({ reps: 5, addedKg: 20 }), 80);
    expect(score).toBeCloseTo(5 * (100 / 80), 5);
  });

  it('sprint: distanceM * (intensityPct/100)^2', () => {
    const ex = exercise({ metric: 'sprint' });
    const score = computeSetScore(ex, undefined, set({ distanceM: 20, intensityPct: 90 }), 80);
    expect(score).toBeCloseTo(20 * 0.81, 5);
  });

  it('timeOnly scores like hold, consistent with AM holds now being tracked (SPEC-V1.1.md 2.3)', () => {
    const ex = exercise({ metric: 'timeOnly' });
    expect(computeSetScore(ex, undefined, set({ seconds: 20 }), 80)).toBe(20);
  });

  it('distanceTime still scores 0 (completion only — no scoring formula in SPEC.md)', () => {
    expect(computeSetScore(exercise({ metric: 'distanceTime' }), undefined, set({ reps: 40 }), 80)).toBe(0);
  });

  it('applies ladder + assistance tier + rom penalty to raise/lower the factor', () => {
    const ladder: Ladder = {
      id: 'frontLever',
      assistanceTiers: ['none', 'light band', 'medium band', 'heavy band'],
      variants: [{ id: 'one-leg', label: 'one-leg', level: 3 }],
    };
    const ex = exercise({ metric: 'hold', ladderId: 'frontLever' });
    const clean = computeSetScore(ex, ladder, set({ seconds: 6, variantId: 'one-leg', assistanceTier: 0 }), 80);
    const flagged = computeSetScore(
      ex,
      ladder,
      set({ seconds: 6, variantId: 'one-leg', assistanceTier: 0, techniqueFlags: ['partialROM'] }),
      80,
    );
    expect(clean).toBeCloseTo(6 * intensityFactor(3), 5);
    expect(flagged).toBeLessThan(clean);
  });
});

describe('relative strength', () => {
  it('relativeLoad and est1RMrelative', () => {
    expect(relativeLoad(80, 20)).toBeCloseTo(1.25, 5);
    expect(est1RMrelative(80, 20, 6)).toBeCloseTo(1.25 * 1.2, 5);
  });
});

describe('isQualifyingSet', () => {
  it('excludes any technique flag or RPE 10', () => {
    expect(isQualifyingSet(set({ reps: 5 }))).toBe(true);
    expect(isQualifyingSet(set({ reps: 5, techniqueFlags: ['hipsSagged'] }))).toBe(false);
    expect(isQualifyingSet(set({ reps: 5, rpe: 10 }))).toBe(false);
    expect(isQualifyingSet(set({ reps: 5, rpe: 9.5 }))).toBe(true);
  });

  it('excludes sets with no raw value at all — v1.0 AM checklist completion markers', () => {
    // { id, techniqueFlags: [], score: 0 } is exactly what toggleAmChecklistItem
    // wrote pre-v1.1 (useStore.ts) — it must never qualify as a baseline.
    expect(isQualifyingSet(set())).toBe(false);
  });

  it('qualifies a seconds-only set (holds/timeOnly) and an attempts-only set', () => {
    expect(isQualifyingSet(set({ seconds: 12 }))).toBe(true);
    expect(isQualifyingSet(set({ attempts: [4, 5] }))).toBe(true);
  });
});

describe('sessionLoad and exerciseSessionBest', () => {
  const s = session({
    exercises: [
      {
        exerciseId: 'ex1',
        sets: [set({ reps: 5 }), set({ reps: 8, techniqueFlags: ['usedMomentum'] }), set({ reps: 6 })],
      },
    ],
  });

  it('sessionLoad sums every set score with no exclusions', () => {
    expect(sessionLoad(s, (_id, st) => st.reps ?? 0)).toBe(19);
  });

  it('exerciseSessionBest excludes flagged sets from the max', () => {
    expect(exerciseSessionBest(s, 'ex1', (st) => st.reps ?? 0)).toBe(6);
  });

  it('exerciseSessionBest is null when nothing qualifies', () => {
    const onlyFlagged = session({
      exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 8, techniqueFlags: ['collapsed'] })] }],
    });
    expect(exerciseSessionBest(onlyFlagged, 'ex1', (st) => st.reps ?? 0)).toBeNull();
  });
});

describe('Exercise Progress Index — hand-computed fixture', () => {
  const scoreForSet = (st: SetLog) => st.reps ?? 0;

  const sessionLogs: Record<string, SessionLog> = {
    w1: session({ id: 'w1', date: '2026-01-01', week: 1, exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 10 })] }] }),
    w2: session({ id: 'w2', date: '2026-01-08', week: 2, exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 12 })] }] }),
    w3: session({ id: 'w3', date: '2026-01-15', week: 3, exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 12 })] }] }),
    w4: session({ id: 'w4', date: '2026-01-22', week: 4, exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 13 })] }] }),
    w5: session({ id: 'w5', date: '2026-01-29', week: 5, exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 12 })] }] }),
  };

  const history = buildExerciseHistory(sessionLogs, 'ex1', scoreForSet);

  it('baseline is the best qualifying score across weeks 1-2', () => {
    expect(exerciseBaseline(history)).toBe(12);
  });

  it('current is the best qualifying score across the last 3 sessions', () => {
    expect(exerciseCurrent(history)).toBe(13);
  });

  it('progressIndex = current / baseline * 100', () => {
    expect(exerciseProgressIndex(history)).toBeCloseTo((13 / 12) * 100, 5);
  });

  it('is null when there is no baseline yet', () => {
    expect(exerciseProgressIndex([])).toBeNull();
  });

  it('flagged sets never become the baseline or current best', () => {
    const flaggedLogs: Record<string, SessionLog> = {
      w1: session({
        id: 'w1',
        date: '2026-01-01',
        week: 1,
        exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 20, techniqueFlags: ['collapsed'] }), set({ reps: 10 })] }],
      }),
    };
    const h = buildExerciseHistory(flaggedLogs, 'ex1', scoreForSet);
    expect(exerciseBaseline(h)).toBe(10);
  });
});

describe('exerciseRollingBestRaw', () => {
  it('takes the best qualifying raw reps/seconds across the last 3 other sessions', () => {
    const sessionLogs: Record<string, SessionLog> = {
      w1: session({ id: 'w1', date: '2026-01-01', exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 5 })] }] }),
      w2: session({ id: 'w2', date: '2026-01-08', exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 8 })] }] }),
      current: session({
        id: 'current',
        date: '2026-01-15',
        exercises: [{ exerciseId: 'ex1', sets: [set({ reps: 3 })] }],
      }),
    };
    expect(exerciseRollingBestRaw(sessionLogs, 'ex1', 'reps', 'current')).toBe(8);
  });

  it('reads seconds for hold/attempts/timeOnly metrics', () => {
    const sessionLogs: Record<string, SessionLog> = {
      w1: session({ id: 'w1', date: '2026-01-01', exercises: [{ exerciseId: 'ex1', sets: [set({ seconds: 7 })] }] }),
    };
    expect(exerciseRollingBestRaw(sessionLogs, 'ex1', 'hold', 'none')).toBe(7);
    expect(exerciseRollingBestRaw(sessionLogs, 'ex1', 'timeOnly', 'none')).toBe(7);
  });

  it('is null with no prior sessions', () => {
    expect(exerciseRollingBestRaw({}, 'ex1', 'reps', 'none')).toBeNull();
  });
});
