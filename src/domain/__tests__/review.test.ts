import { describe, expect, it } from 'vitest';
import { buildWeeklyReview, checkEndOfBlockTargets } from '../review';
import { program } from '../../data/program';
import { ladders } from '../../data/ladders';
import { targets } from '../../data/targets';
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
    phase: 'baseline',
    day: 'mon',
    block: 'main',
    startedAt: `${date}T08:00:00.000Z`,
    completedAt: `${date}T09:00:00.000Z`,
    exercises: [{ exerciseId, sets }],
    updatedAt: `${date}T09:00:00.000Z`,
  };
}

function longRunSession(date: string, week: number, sets: SetLog[]): SessionLog {
  return {
    id: `${date}:main`,
    date,
    week,
    phase: 'marathonPeak',
    day: 'sun',
    block: 'main',
    startedAt: `${date}T08:00:00.000Z`,
    completedAt: `${date}T11:00:00.000Z`,
    exercises: [{ exerciseId: 'sun-long-run', sets }],
    updatedAt: `${date}T11:00:00.000Z`,
  };
}

describe('buildWeeklyReview', () => {
  it('counts completed main sessions and derives planned totals from the program', () => {
    const sessionLogs: Record<string, SessionLog> = {
      '2026-01-05:main': mainSession('2026-01-05', 1, 'hspu-primary', [set({ reps: 5, rpe: 7 })]),
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
    // A main session every day, GTG on Mon/Wed/Fri, and two later sessions —
    // Wednesday's recovery run has no volume until week 3.
    expect(review.sessionsPlanned).toEqual({ main: 7, am: 3, later: 2 });
    expect(review.sessionsCompleted.main).toBe(1);
    expect(review.phase).toBe('baseline');
  });

  it('plans a third later session from week 3, when the recovery run starts', () => {
    const review = buildWeeklyReview({
      week: 3,
      settings: settings(),
      program,
      ladders,
      sessionLogs: {},
      dailyEntries: {},
      progressionEvents: [],
      mobilityVariableForWeek: () => null,
    });
    expect(review.sessionsPlanned.later).toBe(3);
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
      w1: mainSession('2026-01-05', 1, 'fl-hold-primary', [set({ seconds: 6, rpe: 7 })]),
      w2: mainSession('2026-01-12', 2, 'fl-hold-primary', [set({ seconds: 7, rpe: 7 })]),
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
    expect(flDelta?.current).not.toBeNull();
    expect(flDelta?.current?.kind).toBe('seconds');
  });

  it('carries next week\'s phase note and mobility variable, and is null for week 12', () => {
    const review = buildWeeklyReview({
      week: 7,
      settings: settings(),
      program,
      ladders,
      sessionLogs: {},
      dailyEntries: {},
      progressionEvents: [],
      mobilityVariableForWeek: (w) => (w === 8 ? 'half volume, re-measure' : null),
    });
    expect(review.nextWeek?.week).toBe(8);
    // Week 8 closes wave 2 — a deload under the v4.0 wave model.
    expect(review.nextWeek?.phase).toBe('deload');
    expect(review.nextWeek?.mobilityVariable).toBe('half volume, re-measure');

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
  // The real groups, since the auto-checks match on group id AND item index.
  const base = {
    targetGroups: targets,
    sessionLogs: {},
    dailyEntries: {},
    benchmarkEntries: {},
    settings: settings(),
    week12RetentionPct: () => null,
    asOfDate: '2026-03-30',
  };

  function group(result: ReturnType<typeof checkEndOfBlockTargets>, id: string) {
    return result.find((g) => g.id === id)!;
  }

  it('is unknown for everything with no logged data', () => {
    const result = checkEndOfBlockTargets(base);
    expect(result.every((g) => g.items.every((i) => i.status === 'unknown'))).toBe(true);
  });

  it('marks the weight target against settings.targetWeightKg, not a fixed band', () => {
    const asOfDate = '2026-03-30';
    function entriesAt(weightKg: number): Record<string, DailyEntry> {
      const out: Record<string, DailyEntry> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(asOfDate);
        d.setDate(d.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        out[date] = { date, weightKg, updatedAt: `${date}T12:00:00.000Z` };
      }
      return out;
    }

    const met = checkEndOfBlockTargets({ ...base, dailyEntries: entriesAt(72.5), asOfDate });
    expect(group(met, 'body').items[0].status).toBe('met');

    const unmet = checkEndOfBlockTargets({ ...base, dailyEntries: entriesAt(76), asOfDate });
    expect(group(unmet, 'body').items[0].status).toBe('unmet');

    // Move the goal and the same weight stops qualifying.
    const movedGoal = checkEndOfBlockTargets({
      ...base,
      dailyEntries: entriesAt(72.5),
      settings: settings({ targetWeightKg: 70 }),
      asOfDate,
    });
    expect(group(movedGoal, 'body').items[0].status).toBe('unmet');
  });

  it('marks pull-up and dip maintenance from week-12 retention percentages', () => {
    const result = checkEndOfBlockTargets({
      ...base,
      week12RetentionPct: (id: string) => (id === 'ring-dip' ? 96 : id === 'ring-pullup' ? 95 : null),
    });
    expect(group(result, 'strength').items[0].status).toBe('met'); // pull-up
    expect(group(result, 'strength').items[1].status).toBe('met'); // dip

    const declined = checkEndOfBlockTargets({ ...base, week12RetentionPct: () => 80 });
    expect(group(declined, 'strength').items[0].status).toBe('unmet');
  });

  it('marks the long run met once one session totals two hours', () => {
    const short = checkEndOfBlockTargets({
      ...base,
      sessionLogs: {
        s: longRunSession('2026-03-22', 11, Array.from({ length: 7 }, () => set({ minutes: 15, rpe: 3 }))),
      },
    });
    expect(group(short, 'marathon').items[0].status).toBe('unmet');

    const long = checkEndOfBlockTargets({
      ...base,
      sessionLogs: {
        s: longRunSession('2026-03-22', 11, Array.from({ length: 8 }, () => set({ minutes: 15, rpe: 3 }))),
      },
    });
    // 8 blocks x 15 min = 120.
    expect(group(long, 'marathon').items[0].status).toBe('met');
  });

  it('marks flexibility met only when every measured chain moved the right way', () => {
    // Three benchmarks are lower-better, three higher-better.
    const week1 = {
      date: '2026-01-05',
      week: 1,
      values: { pancakeTorso: 30, middleSplitHip: 30, frontSplitHip: 30, pikeReach: -5, shoulderLiftOff: 10, bridgeShoulder: 0 },
      updatedAt: '2026-01-05T12:00:00.000Z',
    };
    const improved = {
      date: '2026-03-23',
      week: 12,
      values: { pancakeTorso: 20, middleSplitHip: 22, frontSplitHip: 25, pikeReach: 2, shoulderLiftOff: 16, bridgeShoulder: 5 },
      updatedAt: '2026-03-23T12:00:00.000Z',
    };
    const met = checkEndOfBlockTargets({ ...base, benchmarkEntries: { '1': week1, '12': improved } });
    expect(group(met, 'flexibility').items[0].status).toBe('met');

    // One chain going the wrong way is enough to fail it.
    const regressed = { ...improved, values: { ...improved.values, pancakeTorso: 32 } };
    const unmet = checkEndOfBlockTargets({ ...base, benchmarkEntries: { '1': week1, '12': regressed } });
    expect(group(unmet, 'flexibility').items[0].status).toBe('unmet');
  });
});
