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
    phase: 'build1',
    day: 'mon',
    block: 'main',
    startedAt: `${date}T08:00:00.000Z`,
    completedAt: `${date}T09:00:00.000Z`,
    exercises: [{ exerciseId, sets }],
    updatedAt: `${date}T09:00:00.000Z`,
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
    // Four gym sessions: Upper A, Upper B, Mobility + Core, Lower. Football and
    // handstand + mobility are daily tick boxes, not sessions.
    expect(review.sessionsPlanned).toEqual({ main: 4, am: 0, later: 0 });
    expect(review.sessionsCompleted.main).toBe(1);
    expect(review.phase).toBe('build1');
  });

  it('keeps four sessions through Christmas, as floor sessions', () => {
    const review = buildWeeklyReview({
      week: 11,
      settings: settings(),
      program,
      ladders,
      sessionLogs: {},
      dailyEntries: {},
      progressionEvents: [],
      mobilityVariableForWeek: () => null,
    });
    expect(review.sessionsPlanned).toEqual({ main: 4, am: 0, later: 0 });
  });

  it('counts the daily tick boxes against the days they were due', () => {
    const review = buildWeeklyReview({
      week: 1,
      settings: settings(),
      program,
      ladders,
      sessionLogs: {},
      dailyEntries: {
        // 2026-01-07 is a Wednesday
        '2026-01-07': { date: '2026-01-07', checks: { football: true, 'handstand-mobility': true }, updatedAt: 'x' },
        '2026-01-08': { date: '2026-01-08', checks: { 'handstand-mobility': true }, updatedAt: 'x' },
      },
      progressionEvents: [],
      mobilityVariableForWeek: () => null,
    });
    expect(review.checks).toEqual([
      { id: 'handstand-mobility', label: 'Handstand + mobility', done: 2, planned: 7 },
      { id: 'football', label: 'Football', done: 1, planned: 2 },
    ]);
  });

  it('counts protein days against the nutrition table, not a settings band', () => {
    // 80 kg -> the 79.0+ row, protein 175 g.
    const dailyEntries: Record<string, DailyEntry> = {
      '2026-01-05': { date: '2026-01-05', weightKg: 80, proteinG: 175, updatedAt: 'x' },
      '2026-01-06': { date: '2026-01-06', weightKg: 80, proteinG: 172, updatedAt: 'x' },
    };
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
    expect(review.nutrition.proteinAdherenceDays).toBe(1);
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
      week: 4,
      settings: settings(),
      program,
      ladders,
      sessionLogs: {},
      dailyEntries: {},
      progressionEvents: [],
      mobilityVariableForWeek: (w) => (w === 5 ? 'half volume, re-measure' : null),
    });
    expect(review.nextWeek?.week).toBe(5);
    // Week 5 is the block's one deload.
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
    // v6.0 prescribes no flexibility benchmark.
    expect(week12.benchmarkWeek).toBe(false);
  });
});

describe('checkEndOfBlockTargets', () => {
  // The real groups, since the auto-checks match on group id AND item index.
  const base = {
    targetGroups: targets,
    program,
    sessionLogs: {},
    dailyEntries: {},
    settings: settings(),
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

    const movedGoal = checkEndOfBlockTargets({
      ...base,
      dailyEntries: entriesAt(72.5),
      settings: settings({ targetWeightKg: 70 }),
      asOfDate,
    });
    expect(group(movedGoal, 'body').items[0].status).toBe('unmet');
  });

  it('lists every ★ exercise in the peak test, in PEAK_TEST_EXERCISE_IDS order', () => {
    expect(group(checkEndOfBlockTargets(base), 'test').items).toHaveLength(8);
  });

  it('judges a weighted lift on load first: a heavier peak set beats more week-1 reps', () => {
    const logs = (week1: SetLog, peak: SetLog): Record<string, SessionLog> => ({
      a: mainSession('2026-01-05', 1, 'ring-dip', [week1]),
      b: mainSession('2026-03-02', 9, 'ring-dip', [peak]),
    });
    const heavier = checkEndOfBlockTargets({
      ...base,
      sessionLogs: logs(set({ reps: 6, addedKg: 20, rpe: 8 }), set({ reps: 4, addedKg: 25, rpe: 9.5 })),
    });
    expect(group(heavier, 'test').items[1].status).toBe('met'); // ring dip

    const lighter = checkEndOfBlockTargets({
      ...base,
      sessionLogs: logs(set({ reps: 6, addedKg: 20, rpe: 8 }), set({ reps: 6, addedKg: 17.5, rpe: 9.5 })),
    });
    expect(group(lighter, 'test').items[1].status).toBe('unmet');
  });

  it('is unknown until both week 1 and a peak week are logged', () => {
    const onlyWeek1 = checkEndOfBlockTargets({
      ...base,
      sessionLogs: { a: mainSession('2026-01-05', 1, 'hspu-primary', [set({ reps: 5, rpe: 8 })]) },
    });
    expect(group(onlyWeek1, 'test').items[0].status).toBe('unknown');
  });
});
