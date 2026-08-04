import { describe, expect, it } from 'vitest';
import {
  defaultPersistedState,
  defaultSettings,
  ImportError,
  migrate,
  parseImportedState,
  SCHEMA_VERSION,
  serializeState,
  toPersistedState,
} from '../persist';
import type { PersistedState } from '../persist';

describe('migrate', () => {
  it('upgrades schemaVersion to the current version', () => {
    const input = { schemaVersion: 1, settings: defaultSettings() };
    expect(migrate(input, 1).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('preserves provided settings fields and backfills missing ones with defaults', () => {
    const input = { schemaVersion: 1, settings: { blockStartDate: '2026-01-05' } };
    const result = migrate(input, 1);
    expect(result.settings.blockStartDate).toBe('2026-01-05');
    expect(result.settings.startWeightKg).toBe(defaultSettings().startWeightKg);
    expect(result.settings.proteinTargetLow).toBe(defaultSettings().proteinTargetLow);
  });

  it('fills missing top-level collections rather than crashing', () => {
    const input = { schemaVersion: 1, settings: defaultSettings() };
    const result = migrate(input, 1);
    expect(result.dailyEntries).toEqual({});
    expect(result.sessionLogs).toEqual({});
    expect(result.benchmarkEntries).toEqual({});
    expect(result.progressionEvents).toEqual([]);
  });

  // ---- v3 -> v4 (SPEC-V3.0.md section 7) ----

  /** A v3 session whose scores carry the old `raw × (1 + 0.2 × effLevel)` weighting. */
  function v3State() {
    return {
      schemaVersion: 3,
      settings: { ...defaultSettings(), blockStartDate: '2026-01-05' },
      dailyEntries: {},
      benchmarkEntries: {},
      progressionEvents: [],
      sessionLogs: {
        '2026-01-05:main': {
          id: '2026-01-05:main',
          date: '2026-01-05',
          week: 1,
          phase: 'calibration',
          day: 'mon',
          block: 'main',
          startedAt: '2026-01-05T09:00:00.000Z',
          updatedAt: '2026-01-05T09:30:00.000Z',
          exercises: [
            {
              exerciseId: 'pike-hspu',
              sets: [
                // 6 reps at effectiveLevel 3 was stored as 6 × 1.6 = 9.6
                { id: 'a', reps: 6, rpe: 8, variantId: 'deficit-pike', assistanceTier: 0, techniqueFlags: [], score: 9.6 },
                { id: 'b', seconds: 12, techniqueFlags: [], score: 19.2 },
                { id: 'c', attempts: [4, 6], techniqueFlags: [], score: 16 },
              ],
            },
          ],
        },
      },
    };
  }

  it('strips the Difficulty Index weighting out of every stored set score', () => {
    const result = migrate(v3State(), 3);
    const sets = result.sessionLogs['2026-01-05:main'].exercises[0].sets;
    expect(sets[0].score).toBe(6); // reps
    expect(sets[1].score).toBe(12); // seconds
    expect(sets[2].score).toBe(10); // summed attempt seconds
  });

  it('preserves every other field of a rescored set', () => {
    const result = migrate(v3State(), 3);
    const set = result.sessionLogs['2026-01-05:main'].exercises[0].sets[0];
    expect(set.reps).toBe(6);
    expect(set.rpe).toBe(8);
    expect(set.variantId).toBe('deficit-pike');
    expect(set.techniqueFlags).toEqual([]);
  });

  it('preserves session metadata and updatedAt through the v4 pass', () => {
    const result = migrate(v3State(), 3);
    const session = result.sessionLogs['2026-01-05:main'];
    expect(session.week).toBe(1);
    expect(session.day).toBe('mon');
    expect(session.updatedAt).toBe('2026-01-05T09:30:00.000Z');
  });

  it('leaves resetAt unset on a migrated block that has never been reset', () => {
    // Optional and absent, matching carbTargetLow/fatTargetLow — defaultSettings()
    // deliberately omits optional fields rather than spelling them `undefined`.
    const result = migrate(v3State(), 3);
    expect(result.settings.resetAt).toBeUndefined();
  });

  it('preserves a resetAt that was already set', () => {
    const reset = v3State();
    reset.settings = { ...reset.settings, resetAt: '2026-02-01T10:00:00.000Z' };
    expect(migrate(reset, 3).settings.resetAt).toBe('2026-02-01T10:00:00.000Z');
  });

  it('does not rescore when already at the current version', () => {
    const alreadyV4 = { ...v3State(), schemaVersion: SCHEMA_VERSION };
    const result = migrate(alreadyV4, SCHEMA_VERSION);
    expect(result.sessionLogs['2026-01-05:main'].exercises[0].sets[0].score).toBe(9.6);
  });

  it('does not rewrite historical exercise ids, including ones retired from the program', () => {
    const withRetired = v3State();
    withRetired.sessionLogs['2026-01-05:main'].exercises[0].exerciseId = 'hs-balance-primary';
    const result = migrate(withRetired, 3);
    expect(result.sessionLogs['2026-01-05:main'].exercises[0].exerciseId).toBe('hs-balance-primary');
  });

  it('survives a v3 session with no exercises or no sets', () => {
    const sparse = v3State();
    sparse.sessionLogs['2026-01-05:main'].exercises = [];
    expect(() => migrate(sparse, 3)).not.toThrow();
    expect(migrate(sparse, 3).sessionLogs['2026-01-05:main'].exercises).toEqual([]);
  });

  it('carries a v1 export all the way through to v4 scoring in one pass', () => {
    const v1 = {
      schemaVersion: 1,
      settings: { blockStartDate: '2026-01-05' },
      sessionLogs: {
        '2026-01-05:main': {
          id: '2026-01-05:main',
          date: '2026-01-05',
          week: 1,
          phase: 'calibration',
          day: 'mon',
          block: 'main',
          startedAt: '2026-01-05T09:00:00.000Z',
          exercises: [{ exerciseId: 'ring-dip', sets: [{ id: 'a', reps: 8, techniqueFlags: [], score: 14.4 }] }],
        },
      },
      benchmarkEntries: [],
    };
    const result = migrate(v1, 1);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.sessionLogs['2026-01-05:main'].exercises[0].sets[0].score).toBe(8);
    // migrateToV3's backfill still ran on the way past.
    expect(typeof result.sessionLogs['2026-01-05:main'].updatedAt).toBe('string');
  });

  it('leaves existing data untouched when migrating from the current version', () => {
    const state: PersistedState = {
      ...defaultPersistedState(),
      dailyEntries: { '2026-01-05': { date: '2026-01-05', weightKg: 80, updatedAt: '2026-01-05T12:00:00.000Z' } },
    };
    const result = migrate(state, SCHEMA_VERSION);
    expect(result.dailyEntries['2026-01-05'].date).toBe('2026-01-05');
    expect(result.dailyEntries['2026-01-05'].weightKg).toBe(80);
  });
});

describe('export / import round-trip', () => {
  function fullState(): PersistedState {
    return {
      ...defaultPersistedState(),
      dailyEntries: {
        '2026-01-05': { date: '2026-01-05', weightKg: 80, calories: 2300, proteinG: 180, updatedAt: '2026-01-05T12:00:00.000Z' },
      },
      sessionLogs: {
        '2026-01-05:main': {
          id: '2026-01-05:main',
          date: '2026-01-05',
          week: 1,
          phase: 'calibration',
          day: 'mon',
          block: 'main',
          startedAt: '2026-01-05T08:00:00.000Z',
          exercises: [
            {
              exerciseId: 'pike-hspu',
              sets: [{ id: 's1', reps: 5, rpe: 7, techniqueFlags: [], score: 100 }],
            },
          ],
          updatedAt: '2026-01-05T08:30:00.000Z',
        },
      },
      benchmarkEntries: { '1': { date: '2026-01-05', week: 1, values: { kneeToWall: 10 }, updatedAt: '2026-01-05T12:00:00.000Z' } },
      progressionEvents: [
        { id: 'p1', date: '2026-01-05', exerciseId: 'fl-hard-iso', axis: 'cleaner line', from: 'a', to: 'b' },
      ],
    };
  }

  it('round-trips a full state losslessly through JSON', () => {
    const state = fullState();
    const imported = parseImportedState(serializeState(state));
    const importedState = toPersistedState(state);
    // Settings.updatedAt will be refreshed during migration, so check separately
    expect(imported.schemaVersion).toBe(importedState.schemaVersion);
    expect(imported.dailyEntries).toEqual(importedState.dailyEntries);
    expect(imported.sessionLogs).toEqual(importedState.sessionLogs);
    expect(imported.benchmarkEntries).toEqual(importedState.benchmarkEntries);
    expect(imported.progressionEvents).toEqual(importedState.progressionEvents);
    expect(typeof imported.settings.updatedAt).toBe('string');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseImportedState('not json')).toThrow(ImportError);
  });

  it('rejects a JSON payload that is not an object', () => {
    expect(() => parseImportedState('42')).toThrow(ImportError);
    expect(() => parseImportedState('null')).toThrow(ImportError);
  });

  it('rejects a payload missing schemaVersion or settings', () => {
    expect(() => parseImportedState(JSON.stringify({ settings: {} }))).toThrow(ImportError);
    expect(() => parseImportedState(JSON.stringify({ schemaVersion: 1 }))).toThrow(ImportError);
  });

  it('imports a v1.0-shaped export (schemaVersion 1, no v1.1 fields) without loss and backfills updatedAt', () => {
    const v1Export = {
      schemaVersion: 1,
      settings: {
        blockStartDate: '2026-01-05',
        startWeightKg: 77,
        targetWeightKg: 72.5,
        proteinTargetLow: 170,
        proteinTargetHigh: 190,
        units: 'metric',
      },
      dailyEntries: { '2026-01-05': { date: '2026-01-05', weightKg: 77 } },
      sessionLogs: {},
      benchmarkEntries: [],
      progressionEvents: [],
    };
    const imported = parseImportedState(JSON.stringify(v1Export));
    expect(imported.schemaVersion).toBe(SCHEMA_VERSION);
    expect(imported.settings.blockStartDate).toBe('2026-01-05');
    expect(imported.settings.startWeightKg).toBe(77);
    expect(imported.dailyEntries['2026-01-05'].date).toBe('2026-01-05');
    expect(imported.dailyEntries['2026-01-05'].weightKg).toBe(77);
    expect(typeof imported.dailyEntries['2026-01-05'].updatedAt).toBe('string');
  });
});
