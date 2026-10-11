import { describe, expect, it } from 'vitest';
import { addDays, format, parseISO } from 'date-fns';
import { adjustmentKcalAsOf, dailyTargets, nutritionCheck, rowForWeight, sevenDayAverageWeight } from '../nutrition';
import { defaultSettings } from '../../store/persist';
import type { DailyEntry, Settings } from '../types';

const START = '2026-10-11';

function day(i: number): string {
  return format(addDays(parseISO(START), i), 'yyyy-MM-dd');
}

function settings(patch: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), blockStartDate: START, startWeightKg: 78, ...patch };
}

/** One entry per day from `fromDay` for `n` days, weight falling by `perDay`. */
function series(fromDay: number, n: number, startKg: number, perDay: number, calories?: number): DailyEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    date: day(fromDay + i),
    weightKg: startKg + perDay * i,
    ...(calories !== undefined ? { calories } : {}),
    updatedAt: '2026-10-11T20:00:00.000Z',
  }));
}

describe('rowForWeight', () => {
  it('reads the bands inclusively at their lower bound', () => {
    expect(rowForWeight(80).row.kcal).toBe(2100);
    expect(rowForWeight(79).row.kcal).toBe(2100);
    expect(rowForWeight(78.95).row.kcal).toBe(2075);
    expect(rowForWeight(78).row.kcal).toBe(2075);
    expect(rowForWeight(73.2).row).toMatchObject({ kcal: 1950, proteinG: 162, fatG: 65, carbsG: 178 });
  });

  it('holds the bottom row below 73 kg and flags it, rather than inventing one', () => {
    const { row, belowTable } = rowForWeight(72.4);
    expect(row.kcal).toBe(1950);
    expect(belowTable).toBe(true);
  });
});

describe('sevenDayAverageWeight', () => {
  it('averages the weigh-ins in the 7 days ending on the date', () => {
    const entries = series(0, 10, 78, -0.1);
    // days 3..9: 77.7 .. 77.1, mean 77.4
    expect(sevenDayAverageWeight(entries, day(9))?.kg).toBeCloseTo(77.4);
    expect(sevenDayAverageWeight(entries, day(9))?.count).toBe(7);
  });

  it('is null with no weigh-in in the window', () => {
    expect(sevenDayAverageWeight([], day(0))).toBeNull();
  });
});

describe('dailyTargets', () => {
  it('falls back to the start weight on day 1 before any weigh-in', () => {
    const t = dailyTargets([], settings(), day(0));
    expect(t.basis).toBe('start');
    expect(t.kcal).toBe(2075);
  });

  it('uses the 7-day average once weigh-ins exist', () => {
    const t = dailyTargets(series(0, 3, 77.5, 0), settings(), day(2));
    expect(t.basis).toBe('avg7');
    expect(t).toMatchObject({ kcal: 2050, proteinG: 171, fatG: 65, carbsG: 195 });
  });

  it('applies dated adjustments through carbs only', () => {
    const s = settings({ nutritionAdjustments: [{ date: day(20), kcal: -150, reason: 'r' }] });
    const entries = series(0, 30, 77.5, 0);
    expect(dailyTargets(entries, s, day(19)).kcal).toBe(2050);
    const after = dailyTargets(entries, s, day(20));
    expect(after.kcal).toBe(1900);
    expect(after.proteinG).toBe(171);
    expect(after.fatG).toBe(65);
    expect(after.carbsG).toBe(158); // 195 − 37.5
  });

  it('sums adjustments cumulatively', () => {
    const adj = [
      { date: day(14), kcal: -150, reason: '' },
      { date: day(28), kcal: -150, reason: '' },
      { date: day(35), kcal: 150, reason: '' },
    ];
    expect(adjustmentKcalAsOf(adj, day(30))).toBe(-300);
    expect(adjustmentKcalAsOf(adj, day(40))).toBe(-150);
  });
});

describe('nutritionCheck', () => {
  it('holds the table in weeks 1–2', () => {
    const entries = series(0, 13, 78, 0, 2075);
    expect(nutritionCheck(entries, settings(), day(13)).status).toBe('early');
  });

  it('asks for data when the rate cannot be measured', () => {
    expect(nutritionCheck([], settings(), day(20)).status).toBe('needData');
  });

  it('recommends −150 kcal when the weight is flat and intake is on target (rule 3)', () => {
    // Flat at 77.5 kg -> target 2050; eaten exactly.
    const entries = series(0, 21, 77.5, 0, 2050);
    const check = nutritionCheck(entries, settings(), day(20));
    expect(check.status).toBe('tooSlow');
    expect(check.recommendedKcal).toBe(-150);
  });

  it('blames intake, not the target, when the weight is flat but intake was over', () => {
    const entries = series(0, 21, 77.5, 0, 2300);
    const check = nutritionCheck(entries, settings(), day(20));
    expect(check.status).toBe('overTarget');
    expect(check.recommendedKcal).toBeNull();
  });

  it('recommends +150 kcal when losing over 0.75 kg/week on target (rule 4)', () => {
    // −0.15 kg/day ≈ −1.05 kg/week. Intake set to each day's own target.
    const base = series(0, 21, 78.9, -0.15);
    const s = settings();
    const entries = base.map((e) => ({ ...e, calories: dailyTargets(base, s, e.date).kcal }));
    const check = nutritionCheck(entries, s, day(20));
    expect(check.status).toBe('tooFast');
    expect(check.recommendedKcal).toBe(150);
  });

  it('says eat to target first when losing fast because intake was under', () => {
    const entries = series(0, 21, 78.9, -0.15, 1500);
    expect(nutritionCheck(entries, settings(), day(20)).status).toBe('underTarget');
  });

  it('is on track inside 0.25–0.75 kg/week', () => {
    // −0.07 kg/day ≈ −0.49 kg/week
    const base = series(0, 21, 78.5, -0.07);
    const s = settings();
    const entries = base.map((e) => ({ ...e, calories: dailyTargets(base, s, e.date).kcal }));
    expect(nutritionCheck(entries, s, day(20)).status).toBe('onTrack');
  });

  it('waits a week after an adjustment before judging again', () => {
    const entries = series(0, 21, 77.5, 0, 2050);
    const s = settings({ nutritionAdjustments: [{ date: day(17), kcal: -150, reason: '' }] });
    expect(nutritionCheck(entries, s, day(20)).status).toBe('settling');
  });

  it('needs calories on 5 of the last 7 days to judge adherence', () => {
    const entries = series(0, 21, 77.5, 0).map((e, i) => (i >= 17 ? { ...e, calories: 2050 } : e));
    expect(nutritionCheck(entries, settings(), day(20)).status).toBe('needData');
  });
});
