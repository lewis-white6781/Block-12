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
