import { describe, expect, it } from 'vitest';
import {
  est1RMrelative,
  exerciseRollingBestRaw,
  exerciseSessionBest,
  isQualifyingSet,
  placeholderSetScore,
  relativeLoad,
  sessionLoad,
} from '../scoring';
import { plainScore } from '../performance';
import type { SessionLog, SetLog } from '../types';

function set(overrides: Partial<SetLog> = {}): SetLog {
  return { id: 'x', techniqueFlags: [], score: 0, ...overrides };
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
    updatedAt: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('placeholderSetScore', () => {
  it('takes the BEST attempt, not the sum', () => {
    // v3.0: summing rewarded taking more attempts rather than being better at
    // it, and left the CSV's score column disagreeing with the best shown on
    // screen for the same set. Matches performance.ts's setValue.
    expect(placeholderSetScore({ attempts: [4, 6] })).toBe(6);
    expect(placeholderSetScore({ attempts: [9, 3, 5] })).toBe(9);
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

// intensityFactor and computeSetScore were deleted in v3.0 (SPEC-V3.0.md
// section 1). plainScore is their replacement and is covered in
// performance.test.ts; the one case worth keeping here is that sprints still
// use SPEC.md 6.3's distance x intensity^2 formula rather than a raw value.
describe('plainScore keeps the sprint formula', () => {
  it('scores distance x (intensity%)^2', () => {
    expect(plainScore('sprint', set({ distanceM: 60, intensityPct: 90 }))).toBeCloseTo(48.6, 5);
  });

  it('is the raw value for everything else', () => {
    expect(plainScore('reps', set({ reps: 8 }))).toBe(8);
    expect(plainScore('hold', set({ seconds: 12 }))).toBe(12);
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
