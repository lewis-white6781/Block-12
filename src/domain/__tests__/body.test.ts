import { describe, expect, it } from 'vitest';
import {
  caloriesFromMacros,
  corridorStatus,
  projectedWeekTwelveWeight,
  rolling7Calories,
  rolling7Carbs,
  rolling7Fat,
  rolling7Protein,
  rolling7Weight,
  totalChangeFromStart,
  weeklyRateKg,
  weeklyRatePct,
  weeklySummaries,
} from '../body';
import type { DailyEntry, SessionLog } from '../types';

function entry(date: string, overrides: Partial<Omit<DailyEntry, 'date'>> = {}): DailyEntry {
  return { date, ...overrides };
}

describe('rolling7Weight — sparse data', () => {
  it('returns null (not NaN) with fewer than 4 weigh-ins', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-03'];
    for (let n = 0; n <= 3; n++) {
      const entries = days.slice(0, n).map((d) => entry(d, { weightKg: 80 }));
      const result = rolling7Weight(entries, '2026-01-03');
      expect(result).toBeNull();
      expect(Number.isNaN(result)).toBe(false);
    }
  });

  it('returns the mean once there are exactly 4 points', () => {
    const entries = [
      entry('2026-01-01', { weightKg: 80.0 }),
      entry('2026-01-02', { weightKg: 79.9 }),
      entry('2026-01-03', { weightKg: 79.8 }),
      entry('2026-01-04', { weightKg: 79.7 }),
    ];
    expect(rolling7Weight(entries, '2026-01-04')).toBeCloseTo(79.85, 5);
  });
});

describe('11-day linear fixture (hand-verifiable to 2dp)', () => {
  // day i (1-indexed) = 80.0 - 0.1*(i-1), 2026-01-01 .. 2026-01-11
  const entries: DailyEntry[] = Array.from({ length: 11 }, (_, i) =>
    entry(`2026-01-${String(i + 1).padStart(2, '0')}`, { weightKg: Math.round((80 - 0.1 * i) * 10) / 10 }),
  );

  it('computes the correct 7-day rolling average at day 11 and day 4', () => {
    expect(rolling7Weight(entries, '2026-01-11')).toBeCloseTo(79.3, 5);
    expect(rolling7Weight(entries, '2026-01-04')).toBeCloseTo(79.85, 5);
  });

  it('computes the correct weekly rate to 2dp', () => {
    const rate = weeklyRateKg(entries, '2026-01-11');
    expect(rate).not.toBeNull();
    expect(Number(rate!.toFixed(2))).toBe(-0.55);
  });

  it('computes the correct weekly rate percent to 2dp', () => {
    const pct = weeklyRatePct(entries, '2026-01-11');
    expect(pct).not.toBeNull();
    expect(Number(pct!.toFixed(2))).toBe(-0.69);
  });

  it('classifies this rate as on track', () => {
    const rate = weeklyRateKg(entries, '2026-01-11');
    expect(corridorStatus(rate)).toBe('onTrack');
  });

  it('projects week-12 weight from the current rate', () => {
    // 2026-01-01 is a Monday block start; day 11 (2026-01-11) is week 2.
    const projected = projectedWeekTwelveWeight(entries, '2026-01-11', '2026-01-01');
    expect(projected).toBeCloseTo(73.8, 5);
  });

  it('computes total change from a known start weight', () => {
    expect(totalChangeFromStart(entries, '2026-01-11', 80)).toBeCloseTo(-0.7, 5);
  });
});

describe('null propagation', () => {
  const sparse: DailyEntry[] = [entry('2026-01-01', { weightKg: 80 }), entry('2026-01-02', { weightKg: 79.9 })];

  it('weeklyRateKg is null when either rolling window is insufficient', () => {
    expect(weeklyRateKg(sparse, '2026-01-02')).toBeNull();
  });

  it('weeklyRatePct is null when weeklyRateKg is null', () => {
    expect(weeklyRatePct(sparse, '2026-01-02')).toBeNull();
  });

  it('corridorStatus is null when rate is null', () => {
    expect(corridorStatus(null)).toBeNull();
  });

  it('projectedWeekTwelveWeight is null when data is insufficient', () => {
    expect(projectedWeekTwelveWeight(sparse, '2026-01-02', '2026-01-01')).toBeNull();
  });

  it('totalChangeFromStart is null when rolling average is unavailable', () => {
    expect(totalChangeFromStart(sparse, '2026-01-02', 80)).toBeNull();
  });
});

describe('corridorStatus boundaries', () => {
  it('is tooSlow when rate is above -0.30 kg/wk', () => {
    expect(corridorStatus(-0.1)).toBe('tooSlow');
    expect(corridorStatus(0.1)).toBe('tooSlow');
  });

  it('is onTrack at the -0.30 boundary itself', () => {
    expect(corridorStatus(-0.3)).toBe('onTrack');
  });

  it('is onTrack at the -0.60 boundary itself', () => {
    expect(corridorStatus(-0.6)).toBe('onTrack');
  });

  it('is tooFast below -0.60 kg/wk', () => {
    expect(corridorStatus(-0.61)).toBe('tooFast');
  });
});

describe('weeklySummaries', () => {
  function session(id: string, week: number, completed: boolean): SessionLog {
    return {
      id,
      date: '2026-01-01',
      week,
      phase: 'calibration',
      day: 'mon',
      block: 'main',
      startedAt: '2026-01-01T08:00:00.000Z',
      completedAt: completed ? '2026-01-01T09:00:00.000Z' : undefined,
      exercises: [],
    };
  }

  it('computes per-week means, change, rate%, and session counts', () => {
    const entries: DailyEntry[] = [
      ...Array.from({ length: 7 }, (_, i) =>
        entry(`2026-01-${String(i + 1).padStart(2, '0')}`, {
          weightKg: 80,
          calories: 2400,
          proteinG: 180,
          carbsG: 250,
          fatG: 70,
        }),
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        entry(`2026-01-${String(i + 8).padStart(2, '0')}`, {
          weightKg: 79,
          calories: 2300,
          proteinG: 175,
          carbsG: 230,
          fatG: 65,
        }),
      ),
    ];
    const sessionLogs: Record<string, SessionLog> = {
      w1: session('w1', 1, true),
      w2a: session('w2a', 2, true),
      w2b: session('w2b', 2, true),
      w2c: session('w2c', 2, false),
    };

    const summaries = weeklySummaries(entries, sessionLogs, '2026-01-01', 2);

    expect(summaries[0]).toMatchObject({
      week: 1,
      meanWeightKg: 80,
      changeKg: null,
      ratePct: null,
      meanCalories: 2400,
      meanProteinG: 180,
      meanCarbsG: 250,
      meanFatG: 70,
      sessionsCompleted: 1,
    });
    expect(summaries[1].week).toBe(2);
    expect(summaries[1].meanWeightKg).toBeCloseTo(79, 5);
    expect(summaries[1].changeKg).toBeCloseTo(-1, 5);
    expect(summaries[1].ratePct).toBeCloseTo(-1.25, 5);
    expect(summaries[1].meanCarbsG).toBeCloseTo(230, 5);
    expect(summaries[1].meanFatG).toBeCloseTo(65, 5);
    expect(summaries[1].sessionsCompleted).toBe(2);
  });
});

describe('rolling7Calories, rolling7Protein, rolling7Carbs, rolling7Fat', () => {
  it('use the same rolling-mean mechanism on their own fields', () => {
    const entries = [
      entry('2026-01-01', { calories: 2400, proteinG: 180, carbsG: 260, fatG: 75 }),
      entry('2026-01-02', { calories: 2350, proteinG: 175, carbsG: 250, fatG: 72 }),
      entry('2026-01-03', { calories: 2500, proteinG: 185, carbsG: 270, fatG: 80 }),
      entry('2026-01-04', { calories: 2300, proteinG: 170, carbsG: 240, fatG: 68 }),
    ];
    expect(rolling7Calories(entries, '2026-01-04')).toBeCloseTo(2387.5, 5);
    expect(rolling7Protein(entries, '2026-01-04')).toBeCloseTo(177.5, 5);
    expect(rolling7Carbs(entries, '2026-01-04')).toBeCloseTo(255, 5);
    expect(rolling7Fat(entries, '2026-01-04')).toBeCloseTo(73.75, 5);
  });

  it('returns null under the minimum point threshold, same as the other rolling means', () => {
    const entries = [entry('2026-01-01', { carbsG: 260 }), entry('2026-01-02', { fatG: 72 })];
    expect(rolling7Carbs(entries, '2026-01-02')).toBeNull();
    expect(rolling7Fat(entries, '2026-01-02')).toBeNull();
  });
});

describe('caloriesFromMacros', () => {
  it('computes 4/4/9 kcal per gram of protein/carbs/fat', () => {
    expect(caloriesFromMacros(180, 250, 70)).toBe(180 * 4 + 250 * 4 + 70 * 9);
  });

  it('is zero for zero macros', () => {
    expect(caloriesFromMacros(0, 0, 0)).toBe(0);
  });
});
