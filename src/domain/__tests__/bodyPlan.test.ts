// v5.1 metric audit — the target trajectory vs the rate corridor (brief §B).
import { describe, expect, it } from 'vitest';
import {
  corridorTargetMismatch,
  planVarianceKg,
  plannedWeightOnDate,
  requiredWeeklyRateKg,
  TUNING,
} from '../body';
import type { DailyEntry, Settings } from '../types';

function settings(patch: Partial<Settings> = {}): Settings {
  return {
    blockStartDate: '2026-09-07',
    startWeightKg: 80,
    targetWeightKg: 73,
    proteinTargetLow: 170,
    proteinTargetHigh: 190,
    units: 'metric',
    weightUnit: 'kg',
    updatedAt: '2026-09-07T00:00:00.000Z',
    ...patch,
  };
}

function weightEntries(pairs: [string, number][]): DailyEntry[] {
  return pairs.map(([date, weightKg]) => ({ date, weightKg, updatedAt: `${date}T08:00:00.000Z` }));
}

describe('requiredWeeklyRateKg', () => {
  it('is the 12-week straight-line rate the chosen target implies', () => {
    expect(requiredWeeklyRateKg(settings())).toBeCloseTo(-7 / 12, 5);
  });
});

describe('plannedWeightOnDate', () => {
  it('interpolates linearly across the 84-day block using real elapsed days', () => {
    expect(plannedWeightOnDate(settings(), '2026-09-07')).toBe(80);
    expect(plannedWeightOnDate(settings(), '2026-10-19')).toBeCloseTo(80 - 7 * (42 / 84), 5); // day 42
    expect(plannedWeightOnDate(settings(), '2026-11-30')).toBe(73); // day 84
  });

  it('clamps outside the block instead of extrapolating', () => {
    expect(plannedWeightOnDate(settings(), '2026-08-01')).toBe(80);
    expect(plannedWeightOnDate(settings(), '2027-01-01')).toBe(73);
  });
});

describe('planVarianceKg', () => {
  it('is null without a rolling average — never an invented estimate', () => {
    expect(planVarianceKg([], '2026-09-14', settings())).toBeNull();
  });

  it('compares the rolling average to the trajectory on the same date', () => {
    const entries = weightEntries([
      ['2026-09-08', 79.5],
      ['2026-09-09', 79.5],
      ['2026-09-10', 79.5],
      ['2026-09-11', 79.5],
    ]);
    // Day 7 of the plan expects 80 − 7×(7/84) ≈ 79.417 kg; rolling avg is 79.5.
    const variance = planVarianceKg(entries, '2026-09-14', settings());
    expect(variance).not.toBeNull();
    expect(variance!).toBeCloseTo(79.5 - (80 - 7 * (7 / 84)), 5);
  });
});

describe('corridorTargetMismatch', () => {
  it('accepts the shipped 80 → 73 target, whose required rate sits inside the corridor', () => {
    expect(corridorTargetMismatch(settings())).toBeNull();
  });

  it('flags a target whose required rate the corridor cannot deliver', () => {
    // 80 -> 70 in 12 weeks needs −0.83 kg/week, past the −0.6 "too fast" wall.
    const message = corridorTargetMismatch(settings({ targetWeightKg: 70 }));
    expect(message).toContain('-0.83');
    expect(message).toContain(String(TUNING.CORRIDOR_TOO_FAST_KG));
  });

  it('flags a non-cut configuration instead of judging it by cut rules', () => {
    expect(corridorTargetMismatch(settings({ targetWeightKg: 85 }))).toContain('not below start');
  });
});
