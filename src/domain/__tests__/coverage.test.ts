import { describe, expect, it } from 'vitest';
import { buildWeekCoverage } from '../coverage';
import { program } from '../../data/program';
import { plannedSessions } from '../review';
import type { DailyEntry, SessionLog } from '../types';

const BLOCK_START = '2026-09-07'; // a Monday

function session(id: string, patch: Partial<SessionLog> = {}): SessionLog {
  const [date, block] = id.split(':');
  return {
    id,
    date,
    week: 1,
    phase: 'reentry',
    day: 'mon',
    block: block as SessionLog['block'],
    startedAt: `${date}T10:00:00.000Z`,
    exercises: [],
    updatedAt: `${date}T10:00:00.000Z`,
    ...patch,
  };
}

function daily(date: string, patch: Partial<DailyEntry> = {}): DailyEntry {
  return { date, updatedAt: `${date}T08:00:00.000Z`, ...patch };
}

describe('buildWeekCoverage', () => {
  it('plans exactly the slots the program prescribes for the week', () => {
    const coverage = buildWeekCoverage({
      week: 1,
      blockStartDate: BLOCK_START,
      todayISO: '2026-09-07',
      program,
      sessionLogs: {},
      dailyEntries: {},
    });
    const planned = plannedSessions(1);
    expect(coverage.planned).toBe(planned.am + planned.main + planned.later);
  });

  it('marks future prescribed slots upcoming, past unlogged slots unknown', () => {
    // Mid-week: Wednesday of week 1.
    const coverage = buildWeekCoverage({
      week: 1,
      blockStartDate: BLOCK_START,
      todayISO: '2026-09-09',
      program,
      sessionLogs: {},
      dailyEntries: {},
    });
    expect(coverage.unknown).toBeGreaterThan(0);
    expect(coverage.upcoming).toBeGreaterThan(0);
    expect(coverage.unknown + coverage.upcoming).toBe(coverage.planned);
    // Nothing logged, so nothing may claim completion.
    expect(coverage.completed).toBe(0);
    expect(coverage.loggedOnly).toBe(0);
  });

  it('distinguishes completed from merely logged sessions', () => {
    const logs: Record<string, SessionLog> = {
      '2026-09-07:main': session('2026-09-07:main', {
        completedAt: '2026-09-07T11:00:00.000Z',
        exercises: [{ exerciseId: 'x', sets: [{ id: 's1', techniqueFlags: [], score: 0 }] }],
      }),
      '2026-09-08:main': session('2026-09-08:main', {
        day: 'tue',
        exercises: [{ exerciseId: 'x', sets: [{ id: 's2', techniqueFlags: [], score: 0 }] }],
      }),
    };
    const coverage = buildWeekCoverage({
      week: 1,
      blockStartDate: BLOCK_START,
      todayISO: '2026-09-13',
      program,
      sessionLogs: logs,
      dailyEntries: {},
    });
    expect(coverage.completed).toBe(1);
    expect(coverage.loggedOnly).toBe(1);
  });

  it('counts weight and nutrition days against a denominator of 7', () => {
    const dailyEntries: Record<string, DailyEntry> = {
      '2026-09-07': daily('2026-09-07', { weightKg: 80, calories: 2200 }),
      '2026-09-08': daily('2026-09-08', { weightKg: 79.8 }),
      // Outside week 1 — must not count.
      '2026-09-14': daily('2026-09-14', { weightKg: 79.5, calories: 2100 }),
    };
    const coverage = buildWeekCoverage({
      week: 1,
      blockStartDate: BLOCK_START,
      todayISO: '2026-09-13',
      program,
      sessionLogs: {},
      dailyEntries,
    });
    expect(coverage.weightDays).toBe(2);
    expect(coverage.nutritionDays).toBe(1);
  });

  it('flags daily entries first written after the day they describe', () => {
    const dailyEntries: Record<string, DailyEntry> = {
      '2026-09-07': { date: '2026-09-07', weightKg: 80, updatedAt: '2026-09-09T12:00:00.000Z' },
      '2026-09-08': daily('2026-09-08', { weightKg: 79.9 }),
    };
    const coverage = buildWeekCoverage({
      week: 1,
      blockStartDate: BLOCK_START,
      todayISO: '2026-09-13',
      program,
      sessionLogs: {},
      dailyEntries,
    });
    expect(coverage.retrospectiveEntries).toBe(1);
  });
});
