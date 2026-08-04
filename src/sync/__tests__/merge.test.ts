import { describe, expect, it } from 'vitest';
import { mergeState } from '../merge';
import { defaultPersistedState, defaultSettings } from '../../store/persist';
import type { PersistedState, PersistedState as PS } from '../../store/persist';
import type { SessionLog } from '../../domain/types';

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

// ---------------------------------------------------------------------------
// Reset tombstones — SPEC-V3.0.md section 6, acceptance test 74.
//
// These cover the defect SPEC-V2.0.md test 60 wrongly claimed was absent: the
// merge unions keys, so before v3.0 every session deleted by "Reset block"
// came straight back on the next pull.
// ---------------------------------------------------------------------------

function session(id: string, updatedAt: string): SessionLog {
  return {
    id,
    date: id.slice(0, 10),
    week: 1,
    phase: 'calibration',
    day: 'mon',
    block: 'main',
    startedAt: updatedAt,
    updatedAt,
    exercises: [],
  };
}

const BEFORE = '2026-02-01T09:00:00.000Z';
const RESET = '2026-02-01T12:00:00.000Z';
const AFTER = '2026-02-01T15:00:00.000Z';

describe('reset tombstones', () => {
  /** Device A: freshly reset, so its settings are newest and carry resetAt. */
  function localAfterReset(): PersistedState {
    return state({
      settings: { ...defaultSettings(), updatedAt: RESET, resetAt: RESET },
      sessionLogs: {},
    });
  }

  /** Device B: still holding the pre-reset block. */
  function staleRemote(): PersistedState {
    return state({
      settings: { ...defaultSettings(), updatedAt: BEFORE },
      sessionLogs: { '2026-01-05:main': session('2026-01-05:main', BEFORE) },
      dailyEntries: {
        '2026-01-05': { date: '2026-01-05', weightKg: 80, updatedAt: BEFORE },
      },
      progressionEvents: [
        { id: 'p1', date: '2026-01-05', exerciseId: 'pike-hspu', axis: 'greater ROM', from: 'a', to: 'b' },
      ],
    });
  }

  it('does not resurrect sessions deleted by a reset', () => {
    expect(mergeState(localAfterReset(), staleRemote()).sessionLogs).toEqual({});
  });

  it('does not resurrect daily entries or progression events deleted by a reset', () => {
    const merged = mergeState(localAfterReset(), staleRemote());
    expect(merged.dailyEntries).toEqual({});
    expect(merged.progressionEvents).toEqual([]);
  });

  it('honours the reset from whichever side won the settings merge', () => {
    // Reversed: the RESET state arrives as `remote`, the stale block is local.
    const merged = mergeState(staleRemote(), localAfterReset());
    expect(merged.settings.resetAt).toBe(RESET);
  });

  it('keeps remote records written AFTER the reset', () => {
    const remote = state({
      settings: { ...defaultSettings(), updatedAt: BEFORE },
      sessionLogs: {
        '2026-01-05:main': session('2026-01-05:main', BEFORE), // deleted by the reset
        '2026-02-02:main': session('2026-02-02:main', AFTER), // logged on the other device since
      },
    });
    const merged = mergeState(localAfterReset(), remote);
    expect(Object.keys(merged.sessionLogs)).toEqual(['2026-02-02:main']);
  });

  it('never drops a LOCAL record, even one older than the reset', () => {
    // Losing data sitting on the device in front of the athlete is never
    // acceptable; the cutoff only ever filters the remote side.
    const local = state({
      settings: { ...defaultSettings(), updatedAt: RESET, resetAt: RESET },
      sessionLogs: { '2026-01-05:main': session('2026-01-05:main', BEFORE) },
    });
    const merged = mergeState(local, state({ settings: { ...defaultSettings(), updatedAt: BEFORE } }));
    expect(Object.keys(merged.sessionLogs)).toEqual(['2026-01-05:main']);
  });

  it('behaves exactly as before when no reset has ever happened', () => {
    const local = state({ settings: { ...defaultSettings(), updatedAt: BEFORE } });
    const merged = mergeState(local, staleRemote());
    expect(Object.keys(merged.sessionLogs)).toEqual(['2026-01-05:main']);
    expect(merged.progressionEvents).toHaveLength(1);
  });

  it('keeps a progression event dated on the reset day itself', () => {
    // date is a day, not an instant, so same-day events survive — resurrecting
    // one costs a stale list row, dropping one loses a decision permanently.
    const remote = state({
      settings: { ...defaultSettings(), updatedAt: BEFORE },
      progressionEvents: [
        { id: 'p2', date: '2026-02-01', exerciseId: 'pike-hspu', axis: 'greater ROM', from: 'a', to: 'b' },
      ],
    });
    expect(mergeState(localAfterReset(), remote).progressionEvents).toHaveLength(1);
  });
});
