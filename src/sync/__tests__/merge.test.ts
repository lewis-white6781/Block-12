import { describe, expect, it } from 'vitest';
import { mergeState } from '../merge';
import { defaultPersistedState, defaultSettings } from '../../store/persist';
import type { PersistedState, PersistedState as PS } from '../../store/persist';

function state(overrides: Partial<PS> = {}): PersistedState {
  return { ...defaultPersistedState(), ...overrides };
}

describe('mergeState', () => {
  it('prefers remote for settings when remote is newer', () => {
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 1000).toISOString();

    const local = state({
      settings: { ...defaultSettings(), updatedAt: now, startWeightKg: 80 },
    });
    const remote = state({
      settings: { ...defaultSettings(), updatedAt: later, startWeightKg: 75 },
    });

    const merged = mergeState(local, remote);
    expect(merged.settings.startWeightKg).toBe(75);
  });

  it('prefers local for settings when local is newer', () => {
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 1000).toISOString();

    const local = state({
      settings: { ...defaultSettings(), updatedAt: later, startWeightKg: 80 },
    });
    const remote = state({
      settings: { ...defaultSettings(), updatedAt: now, startWeightKg: 75 },
    });

    const merged = mergeState(local, remote);
    expect(merged.settings.startWeightKg).toBe(80);
  });

  it('merges dailyEntries by key with last-write-wins', () => {
    const local = state({
      dailyEntries: {
        '2026-01-05': { date: '2026-01-05', weightKg: 80, updatedAt: '2026-01-05T10:00:00.000Z' },
        '2026-01-06': { date: '2026-01-06', weightKg: 79, updatedAt: '2026-01-06T10:00:00.000Z' },
      },
    });
    const remote = state({
      dailyEntries: {
        '2026-01-05': { date: '2026-01-05', weightKg: 81, updatedAt: '2026-01-05T12:00:00.000Z' }, // newer, wins
        '2026-01-07': { date: '2026-01-07', weightKg: 78, updatedAt: '2026-01-07T10:00:00.000Z' }, // new on remote
      },
    });

    const merged = mergeState(local, remote);
    expect(merged.dailyEntries['2026-01-05'].weightKg).toBe(81); // remote, newer
    expect(merged.dailyEntries['2026-01-06'].weightKg).toBe(79); // local only
    expect(merged.dailyEntries['2026-01-07'].weightKg).toBe(78); // remote only
  });

  it('merges sessionLogs by key with last-write-wins', () => {
    const local = state({
      sessionLogs: {
        '2026-01-05:main': {
          id: '2026-01-05:main',
          date: '2026-01-05',
          week: 1,
          phase: 'calibration',
          day: 'mon',
          block: 'main',
          startedAt: '2026-01-05T08:00:00.000Z',
          exercises: [{ exerciseId: 'pike-hspu', sets: [] }],
          updatedAt: '2026-01-05T10:00:00.000Z',
        },
      },
    });
    const remote = state({
      sessionLogs: {
        '2026-01-05:main': {
          id: '2026-01-05:main',
          date: '2026-01-05',
          week: 1,
          phase: 'calibration',
          day: 'mon',
          block: 'main',
          startedAt: '2026-01-05T08:00:00.000Z',
          exercises: [{ exerciseId: 'pike-hspu', sets: [{ id: 's1', score: 10, techniqueFlags: [] }] }],
          updatedAt: '2026-01-05T12:00:00.000Z', // newer
        },
      },
    });

    const merged = mergeState(local, remote);
    expect(merged.sessionLogs['2026-01-05:main'].exercises[0].sets.length).toBe(1); // remote, newer
  });

  it('merges benchmarkEntries by key with last-write-wins', () => {
    const local = state({
      benchmarkEntries: {
        '1': { date: '2026-01-05', week: 1, values: { kneeToWall: 10 }, updatedAt: '2026-01-05T10:00:00.000Z' },
        '6': { date: '2026-01-12', week: 6, values: { kneeToWall: 12 }, updatedAt: '2026-01-12T10:00:00.000Z' },
      },
    });
    const remote = state({
      benchmarkEntries: {
        '1': { date: '2026-01-05', week: 1, values: { kneeToWall: 11 }, updatedAt: '2026-01-05T12:00:00.000Z' }, // newer
        '12': { date: '2026-03-30', week: 12, values: { kneeToWall: 15 }, updatedAt: '2026-03-30T10:00:00.000Z' }, // new
      },
    });

    const merged = mergeState(local, remote);
    expect(merged.benchmarkEntries['1'].values.kneeToWall).toBe(11); // remote, newer
    expect(merged.benchmarkEntries['6'].values.kneeToWall).toBe(12); // local only
    expect(merged.benchmarkEntries['12'].values.kneeToWall).toBe(15); // remote only
  });

  it('merges progressionEvents by id (union, append-only)', () => {
    const local = state({
      progressionEvents: [
        { id: 'p1', date: '2026-01-05', exerciseId: 'fl-hard-iso', axis: 'cleaner line', from: 'a', to: 'b' },
        { id: 'p2', date: '2026-01-10', exerciseId: 'pike-hspu', axis: 'higher feet', from: 'c', to: 'd' },
      ],
    });
    const remote = state({
      progressionEvents: [
        { id: 'p1', date: '2026-01-05', exerciseId: 'fl-hard-iso', axis: 'cleaner line', from: 'a', to: 'b' }, // duplicate, same
        { id: 'p3', date: '2026-01-15', exerciseId: 'ring-dip', axis: 'bigger ROM', from: 'e', to: 'f' }, // new
      ],
    });

    const merged = mergeState(local, remote);
    expect(merged.progressionEvents.length).toBe(3); // p1, p2, p3
    expect(merged.progressionEvents.map((e) => e.id).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(merged.progressionEvents[0].date).toBe('2026-01-05'); // sorted by date
  });

  it('is idempotent against a default remote', () => {
    const local = state({
      dailyEntries: {
        '2026-01-05': { date: '2026-01-05', weightKg: 80, updatedAt: '2026-01-05T12:00:00.000Z' },
      },
    });
    const remote = defaultPersistedState();

    const merged = mergeState(local, remote);
    // Local's dailyEntries should survive (remote is empty); settings from local (newer or equal)
    expect(Object.keys(merged.dailyEntries).length).toBeGreaterThan(0);
  });

  it('treats equal timestamps as a tie, preferring local (stable, arbitrary)', () => {
    const now = '2026-01-05T12:00:00.000Z';

    const local = state({
      dailyEntries: {
        '2026-01-05': { date: '2026-01-05', weightKg: 80, updatedAt: now },
      },
    });
    const remote = state({
      dailyEntries: {
        '2026-01-05': { date: '2026-01-05', weightKg: 81, updatedAt: now }, // exact same timestamp
      },
    });

    const merged = mergeState(local, remote);
    expect(merged.dailyEntries['2026-01-05'].weightKg).toBe(80); // local wins on tie
  });
});
