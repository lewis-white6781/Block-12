import { describe, expect, it } from 'vitest';
import {
  bestAsOf,
  bestByVariant,
  bestByWeek,
  bestBySession,
  bestKindFor,
  bestOf,
  bestOverall,
  compareBests,
  formatBest,
  setValue,
  trend,
  trendArrow,
} from '../performance';
import type { Best } from '../performance';
import type { Exercise, SessionLog, SetLog } from '../types';

function exercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex',
    name: 'Ex',
    day: 'mon',
    block: 'main',
    order: 1,
    metric: 'reps',
    tracked: true,
    cues: [],
    progressionLadder: [],
    stopRules: [],
    prescriptions: [],
    ...over,
  };
}

function set(over: Partial<SetLog> = {}): SetLog {
  return { id: 's', techniqueFlags: [], score: 0, ...over };
}

function best(over: Partial<Best> = {}): Best {
  return { kind: 'reps', value: 5, date: '2026-01-05', week: 1, ...over };
}

function session(date: string, week: number, sets: SetLog[], exerciseId = 'ex'): SessionLog {
  return {
    id: `${date}:main`,
    date,
    week,
    phase: 'calibration',
    day: 'mon',
    block: 'main',
    startedAt: `${date}T09:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
    exercises: [{ exerciseId, sets }],
  };
}

function logs(...sessions: SessionLog[]): Record<string, SessionLog> {
  return Object.fromEntries(sessions.map((s) => [s.id, s]));
}

describe('bestKindFor', () => {
  it('maps every metric to a unit the athlete can read', () => {
    expect(bestKindFor('reps')).toBe('reps');
    expect(bestKindFor('weightedReps')).toBe('weightedReps');
    expect(bestKindFor('hold')).toBe('seconds');
    expect(bestKindFor('timeOnly')).toBe('seconds');
    expect(bestKindFor('attempts')).toBe('seconds');
    expect(bestKindFor('sprint')).toBe('distance');
    expect(bestKindFor('distanceTime')).toBe('reps');
  });
});

describe('setValue', () => {
  it('reads reps for rep-based metrics', () => {
    expect(setValue('reps', set({ reps: 8 }))).toBe(8);
    expect(setValue('weightedReps', set({ reps: 6, addedKg: 10 }))).toBe(6);
  });

  it('reads seconds for holds', () => {
    expect(setValue('hold', set({ seconds: 12 }))).toBe(12);
  });

  it('reports the BEST attempt, not the sum', () => {
    // The sum would reward taking more attempts, which is not being better at it.
    expect(setValue('attempts', set({ attempts: [4, 9, 3] }))).toBe(9);
  });

  it('is undefined when the set carries no raw value', () => {
    expect(setValue('reps', set())).toBeUndefined();
  });
});

describe('compareBests', () => {
  it('ranks a higher raw value first', () => {
    expect(compareBests(best({ value: 8 }), best({ value: 5 }))).toBeLessThan(0);
  });

  it('ranks LOAD above reps for weighted movements', () => {
    const heavy = best({ kind: 'weightedReps', value: 1, addedKg: 25 });
    const light = best({ kind: 'weightedReps', value: 8, addedKg: 20 });
    expect(compareBests(heavy, light)).toBeLessThan(0);
  });

  it('falls back to reps when the load is equal', () => {
    const more = best({ kind: 'weightedReps', value: 8, addedKg: 20 });
    const fewer = best({ kind: 'weightedReps', value: 5, addedKg: 20 });
    expect(compareBests(more, fewer)).toBeLessThan(0);
  });

  it('treats LOWER romCm as better — the one inverted comparison', () => {
    const deep = best({ value: 5, romCm: 10 });
    const shallow = best({ value: 5, romCm: 20 });
    expect(compareBests(deep, shallow)).toBeLessThan(0);
  });

  it('is a tie when nothing separates them', () => {
    expect(compareBests(best(), best())).toBe(0);
  });
});

describe('bestBySession', () => {
  const ex = exercise();

  it('takes the best qualifying set per session, oldest first', () => {
    const history = bestBySession(
      logs(
        session('2026-01-12', 2, [set({ reps: 6 }), set({ reps: 9 })]),
        session('2026-01-05', 1, [set({ reps: 5 })]),
      ),
      ex,
    );
    expect(history.map((h) => [h.date, h.best.value])).toEqual([
      ['2026-01-05', 5],
      ['2026-01-12', 9],
    ]);
  });

  it('excludes flagged sets, RPE 10 sets, and sets with no raw value', () => {
    const history = bestBySession(
      logs(
        session('2026-01-05', 1, [
          set({ reps: 20, techniqueFlags: ['partialROM'] }),
          set({ reps: 15, rpe: 10 }),
          set({ reps: 7 }),
        ]),
      ),
      ex,
    );
    expect(history[0].best.value).toBe(7);
  });

  it('omits a session entirely when nothing in it qualified', () => {
    const history = bestBySession(
      logs(session('2026-01-05', 1, [set({ reps: 9, techniqueFlags: ['collapsed'] })])),
      ex,
    );
    expect(history).toEqual([]);
  });

  it('ignores sessions that never logged this exercise', () => {
    expect(bestBySession(logs(session('2026-01-05', 1, [set({ reps: 9 })], 'other')), ex)).toEqual([]);
  });
});

describe('bestByVariant', () => {
  const ex = exercise();

  it('keeps a rep PR at an easier variant from beating a harder variant', () => {
    const history = bestBySession(
      logs(
        session('2026-01-05', 1, [set({ reps: 4, variantId: 'wall-hspu-full', assistanceTier: 0 })]),
        session('2026-01-12', 2, [set({ reps: 12, variantId: 'wall-hspu-partial', assistanceTier: 0 })]),
      ),
      ex,
    );
    const groups = bestByVariant(history);
    expect(groups.size).toBe(2);
    expect(groups.get('wall-hspu-full:0')?.value).toBe(4);
    expect(groups.get('wall-hspu-partial:0')?.value).toBe(12);
  });

  it('separates assistance tiers within the same variant', () => {
    const history = bestBySession(
      logs(
        session('2026-01-05', 1, [set({ reps: 10, variantId: 'v', assistanceTier: 2 })]),
        session('2026-01-12', 2, [set({ reps: 4, variantId: 'v', assistanceTier: 0 })]),
      ),
      ex,
    );
    expect(bestByVariant(history).size).toBe(2);
  });
});

describe('trend', () => {
  const ex = exercise();

  function historyOf(...values: number[]) {
    return bestBySession(
      logs(...values.map((v, i) => session(`2026-01-${String(5 + i).padStart(2, '0')}`, 1, [set({ reps: v })]))),
      ex,
    );
  }

  it('is null until there is something on both sides to compare', () => {
    expect(trend(historyOf())).toBeNull();
    expect(trend(historyOf(5))).toBeNull();
    expect(trend(historyOf(5, 5))).toBeNull();
  });

  it('reports up on a clear improvement', () => {
    expect(trend(historyOf(5, 5, 5, 8, 9))).toBe('up');
  });

  it('reports down on a clear regression', () => {
    expect(trend(historyOf(9, 9, 9, 5, 5))).toBe('down');
  });

  it('reports flat inside the 3% dead band', () => {
    // 100 -> 102 is under the 1.03 threshold in both directions.
    expect(trend(historyOf(100, 100, 100, 102, 102))).toBe('flat');
  });

  it('uses the same 3% threshold as the stagnation rule, in both directions', () => {
    expect(trend(historyOf(100, 100, 100, 103, 103))).toBe('up');
    expect(trend(historyOf(103, 103, 103, 100, 100))).toBe('down');
  });
});

describe('bestByWeek', () => {
  it('returns 12 slots, sparse where nothing was logged', () => {
    const history = bestBySession(
      logs(session('2026-01-05', 1, [set({ reps: 5 })]), session('2026-01-19', 3, [set({ reps: 8 })])),
      exercise(),
    );
    const weeks = bestByWeek(history);
    expect(weeks).toHaveLength(12);
    expect(weeks[0]?.value).toBe(5);
    expect(weeks[1]).toBeNull();
    expect(weeks[2]?.value).toBe(8);
  });
});

describe('bestAsOf / bestOverall', () => {
  const history = () =>
    bestBySession(
      logs(
        session('2026-01-05', 1, [set({ reps: 5 })]),
        session('2026-02-02', 5, [set({ reps: 11 })]),
      ),
      exercise(),
    );

  it('bestAsOf ignores anything logged after the cutoff', () => {
    expect(bestAsOf(history(), '2026-01-10')?.value).toBe(5);
  });

  it('bestOverall spans everything', () => {
    expect(bestOverall(history())?.value).toBe(11);
  });

  it('both are null on an empty history', () => {
    expect(bestAsOf([], '2026-01-10')).toBeNull();
    expect(bestOverall([])).toBeNull();
    expect(bestOf([])).toBeNull();
  });
});

describe('formatBest', () => {
  it('renders each kind in its own unit', () => {
    expect(formatBest(best({ kind: 'reps', value: 8 }))).toBe('8 reps');
    expect(formatBest(best({ kind: 'seconds', value: 12 }))).toBe('12 s');
    expect(formatBest(best({ kind: 'distance', value: 60 }))).toBe('60 m');
  });

  it('appends load and depth when present', () => {
    expect(formatBest(best({ kind: 'weightedReps', value: 6, addedKg: 10 }))).toBe('6 reps @ +10 kg');
    expect(formatBest(best({ value: 6, romCm: 15 }))).toBe('6 reps · 15 cm');
  });

  it('omits a zero added load rather than printing "@ +0 kg"', () => {
    expect(formatBest(best({ kind: 'weightedReps', value: 6, addedKg: 0 }))).toBe('6 reps');
  });

  it('renders an em dash for no best', () => {
    expect(formatBest(null)).toBe('—');
  });
});

describe('trendArrow', () => {
  it('is empty when there is no trend yet', () => {
    expect(trendArrow(null)).toBe('');
    expect(trendArrow('up')).toBe('↑');
    expect(trendArrow('flat')).toBe('→');
    expect(trendArrow('down')).toBe('↓');
  });
});
