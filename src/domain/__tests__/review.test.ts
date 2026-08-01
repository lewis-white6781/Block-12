import { describe, expect, it } from 'vitest';
import { buildWeeklyReview, checkEndOfBlockTargets } from '../review';
import { program } from '../../data/program';
import { ladders } from '../../data/ladders';
import type { DailyEntry, SessionLog, Settings, SetLog } from '../types';

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    blockStartDate: '2026-01-05', // a Monday
    startWeightKg: 80,
    targetWeightKg: 72.5,
    proteinTargetLow: 170,
    proteinTargetHigh: 190,
    units: 'metric',
    weightUnit: 'kg',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function set(overrides: Partial<SetLog> = {}): SetLog {
  return { id: 'x', techniqueFlags: [], score: 0, ...overrides };
}

function mainSession(date: string, week: number, exerciseId: string, sets: SetLog[]): SessionLog {
  return {
    id: `${date}:main`,
    date,
    week,
    phase: 'calibration',
    day: 'mon',
    block: 'main',
    startedAt: `${date}T08:00:00.000Z`,
    completedAt: `${date}T09:00:00.000Z`,
    exercises: [{ exerciseId, sets }],
    updatedAt: `${date}T09:00:00.000Z`,
  };
}

describe('buildWeeklyReview', () => {
  it('counts completed main sessions and reports planned totals per SPEC.md 7.6', () => {
    const sessionLogs: Record<string, SessionLog> = {
      '2026-01-05:main': mainSession('2026-01-05', 1, 'pike-hspu', [set({ reps: 5, rpe: 7 })]),
    };
    const review = buildWeeklyReview({
      week: 1,
      settings: settings(),
      program,
      ladders,
      sessionLogs,
      dailyEntries: {},
      progressionEvents: [],
      mobilityVariableForWeek: () => null,
    });
    expect(review.sessionsPlanned).toEqual({ main: 5, am: 7 });
    expect(review.sessionsCompleted.main).toBe(1);
    expect(review.phase).toBe('calibration');
  });

  it('reports weight status null with no daily entries, and a value once there is enough data', () => {
    const dailyEntries: Record<string, DailyEntry> = {};
    for (let i = 0; i < 7; i++) {
      const date = `2026-01-${String(5 + i).padStart(2, '0')}`;
      dailyEntries[date] = { date, weightKg: 80 - i * 0.1, updatedAt: `${date}T12:00:00.000Z` };
    }
    const review = buildWeeklyReview({
      week: 1,
      settings: settings(),
      program,
      ladders,
      sessionLogs: {},
      dailyEntries,
      progressionEvents: [],
      mobilityVariableForWeek: () => null,
    });
    expect(review.weight.meanKg).not.toBeNull();
  });

  it('computes a per-skill progress index once weeks 1-2 baseline data exists', () => {
    const sessionLogs: Record<string, SessionLog> = {
      w1: mainSession('2026-01-05', 1, 'fl-hard-iso', [set({ seconds: 6, rpe: 7 })]),
      w2: mainSession('2026-01-12', 2, 'fl-hard-iso', [set({ seconds: 7, rpe: 7 })]),
    };
    const review = buildWeeklyReview({
      week: 2,
      settings: settings(),
      program,
      ladders,
      sessionLogs,
      dailyEntries: {},
      progressionEvents: [],
      mobilityVariableForWeek: () => null,
    });
    const flDelta = review.skillDeltas.find((d) => d.skill.id === 'frontLever');
    expect(flDelta?.progressIndex).not.toBeNull();
  });

  it('carries next week\'s phase note and mobility variable, and is null for week 12', () => {
    const review = buildWeeklyReview({
      week: 5,
      settings: settings(),
      program,
      ladders,
      sessionLogs: {},
      dailyEntries: {},
      progressionEvents: [],
      mobilityVariableForWeek: (w) => (w === 6 ? 'half volume, re-test' : null),
    });
    expect(review.nextWeek?.week).toBe(6);
    expect(review.nextWeek?.phase).toBe('deload');
    expect(review.nextWeek?.mobilityVariable).toBe('half volume, re-test');

    const week12 = buildWeeklyReview({
      week: 12,
      settings: settings(),
      program,
      ladders,
      sessionLogs: {},
      dailyEntries: {},
      progressionEvents: [],
      mobilityVariableForWeek: () => null,
    });
    expect(week12.nextWeek).toBeNull();
    expect(week12.benchmarkWeek).toBe(true);
  });
});

describe('checkEndOfBlockTargets', () => {
  const targetGroups = [
    { id: 'body', label: 'Body', items: ['72-73 kg', 'a', 'b', 'dip and pull-up performance broadly maintained'] },
  ];

  it('is unknown for everything with no logged data', () => {
    const result = checkEndOfBlockTargets({
      targetGroups,
      sessionLogs: {},
      dailyEntries: {},
      benchmarkEntries: {},
      settings: settings(),
      week12ProgressIndex: () => null,
      asOfDate: '2026-03-30',
    });
    expect(result[0].items.every((i) => i.status === 'unknown')).toBe(true);
  });

  it('marks the weight target met when the rolling average lands in 72-73 kg', () => {
    const asOfDate = '2026-03-30';
    const dailyEntries: Record<string, DailyEntry> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(asOfDate);
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      dailyEntries[date] = { date, weightKg: 72.5, updatedAt: `${date}T12:00:00.000Z` };
    }
    const result = checkEndOfBlockTargets({
      targetGroups,
      sessionLogs: {},
      dailyEntries,
      benchmarkEntries: {},
      settings: settings(),
      week12ProgressIndex: () => null,
      asOfDate,
    });
    expect(result[0].items[0].status).toBe('met');
  });

  it('marks dip/pull-up maintenance from week-12 progress indexes', () => {
    const result = checkEndOfBlockTargets({
      targetGroups,
      sessionLogs: {},
      dailyEntries: {},
      benchmarkEntries: {},
      settings: settings(),
      week12ProgressIndex: (id) => (id === 'ring-dip' || id === 'ring-pullup' ? 95 : null),
      asOfDate: '2026-03-30',
    });
    expect(result[0].items[3].status).toBe('met');
  });
});
