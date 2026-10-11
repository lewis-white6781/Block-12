import { describe, expect, it } from 'vitest';
import {
  defaultPersistedState,
  defaultSettings,
  ImportError,
  migrate,
  migrateTo,
  parseImportedState,
  SCHEMA_VERSION,
  serializeState,
  toPersistedState,
  V6_BLOCK_START,
  V6_WIPE_CUTOFF,
} from '../persist';
import type { PersistedState } from '../persist';

describe('migrate', () => {
  it('upgrades schemaVersion to the current version', () => {
    const input = { schemaVersion: 1, settings: defaultSettings() };
    expect(migrateTo(input, 1, 7).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('preserves provided settings fields and backfills missing ones with defaults', () => {
    const input = { schemaVersion: 1, settings: { blockStartDate: '2026-01-05' } };
    const result = migrateTo(input, 1, 7);
    expect(result.settings.blockStartDate).toBe('2026-01-05');
    expect(result.settings.startWeightKg).toBe(defaultSettings().startWeightKg);
    expect(result.settings.proteinTargetLow).toBe(defaultSettings().proteinTargetLow);
  });

  it('fills missing top-level collections rather than crashing', () => {
    const input = { schemaVersion: 1, settings: defaultSettings() };
    const result = migrateTo(input, 1, 7);
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
    const result = migrateTo(v3State(), 3, 7);
    const sets = result.sessionLogs['2026-01-05:main'].exercises[0].sets;
    expect(sets[0].score).toBe(6); // reps
    expect(sets[1].score).toBe(12); // seconds
    expect(sets[2].score).toBe(6); // best attempt, not the sum
  });

  it('preserves every other field of a rescored set', () => {
    const result = migrateTo(v3State(), 3, 7);
    const set = result.sessionLogs['2026-01-05:main'].exercises[0].sets[0];
    expect(set.reps).toBe(6);
    expect(set.rpe).toBe(8);
    expect(set.variantId).toBe('deficit-pike');
    expect(set.techniqueFlags).toEqual([]);
  });

  it('preserves session metadata and updatedAt through the v4 pass', () => {
    const result = migrateTo(v3State(), 3, 7);
    const session = result.sessionLogs['2026-01-05:main'];
    expect(session.week).toBe(1);
    expect(session.day).toBe('mon');
    expect(session.updatedAt).toBe('2026-01-05T09:30:00.000Z');
  });

  it('leaves resetAt unset on a migrated block that has never been reset', () => {
    // Optional and absent, matching carbTargetLow/fatTargetLow — defaultSettings()
    // deliberately omits optional fields rather than spelling them `undefined`.
    const result = migrateTo(v3State(), 3, 7);
    expect(result.settings.resetAt).toBeUndefined();
  });

  it('preserves a resetAt that was already set', () => {
    const reset = v3State();
    reset.settings = { ...reset.settings, resetAt: '2026-02-01T10:00:00.000Z' };
    expect(migrateTo(reset, 3, 7).settings.resetAt).toBe('2026-02-01T10:00:00.000Z');
  });

  it('does not rescore when already at the current version', () => {
    const alreadyV4 = { ...v3State(), schemaVersion: SCHEMA_VERSION };
    const result = migrate(alreadyV4, SCHEMA_VERSION);
    expect(result.sessionLogs['2026-01-05:main'].exercises[0].sets[0].score).toBe(9.6);
  });

  it('does not rewrite historical exercise ids, including ones retired from the program', () => {
    const withRetired = v3State();
    withRetired.sessionLogs['2026-01-05:main'].exercises[0].exerciseId = 'hs-balance-primary';
    const result = migrateTo(withRetired, 3, 7);
    expect(result.sessionLogs['2026-01-05:main'].exercises[0].exerciseId).toBe('hs-balance-primary');
  });

  it('survives a v3 session with no exercises or no sets', () => {
    const sparse = v3State();
    sparse.sessionLogs['2026-01-05:main'].exercises = [];
    expect(() => migrateTo(sparse, 3, 7)).not.toThrow();
    expect(migrateTo(sparse, 3, 7).sessionLogs['2026-01-05:main'].exercises).toEqual([]);
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
    const result = migrateTo(v1, 1, 7);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.sessionLogs['2026-01-05:main'].exercises[0].sets[0].score).toBe(8);
    // migrateToV3's backfill still ran on the way past.
    expect(typeof result.sessionLogs['2026-01-05:main'].updatedAt).toBe('string');
  });

  // ---- v4 -> v5 (SPEC-V4.0.md section 1) ----

  /** A v4 session carrying a phase name and a readiness shape that v4.0 retired. */
  function v4State() {
    return {
      schemaVersion: 4,
      settings: { ...defaultSettings(), blockStartDate: '2026-01-05' },
      dailyEntries: {},
      benchmarkEntries: {},
      progressionEvents: [],
      sessionLogs: {
        '2026-02-16:main': {
          id: '2026-02-16:main',
          date: '2026-02-16',
          week: 7,
          phase: 'intensification',
          day: 'mon',
          block: 'main',
          startedAt: '2026-02-16T09:00:00.000Z',
          updatedAt: '2026-02-16T09:30:00.000Z',
          readiness: { sleepHours: 8, soreness: 1, elbowIrritation: 0, shoulderIrritation: 1, motivation: 3 },
          exercises: [{ exerciseId: 'ring-dip', sets: [{ id: 'a', reps: 5, rpe: 8, techniqueFlags: [], score: 5 }] }],
        },
      },
    };
  }

  it('recomputes each session phase from its week under the current block', () => {
    const result = migrateTo(v4State(), 4, 7);
    // The v5 and v6 migrations both recompute phase with phaseForWeek, so any
    // older name ends up at whatever phase.ts says now — week 7 is 'build3'.
    expect(result.sessionLogs['2026-02-16:main'].phase).toBe('build3');
  });

  it('v5 -> v6 recomputes a v4 wave-era phase name from its week', () => {
    const state = v4State();
    state.schemaVersion = 5;
    state.sessionLogs['2026-02-16:main'].phase = 'peak' as never; // v4's week-7 name
    const result = migrateTo(state, 5, 7);
    expect(result.sessionLogs['2026-02-16:main'].phase).toBe('build3');
  });

  it('defaults achillesIrritation to 0 on readiness check-ins that never asked', () => {
    const result = migrateTo(v4State(), 4, 7);
    const readiness = result.sessionLogs['2026-02-16:main'].readiness!;
    expect(readiness.achillesIrritation).toBe(0);
    // and leaves what WAS answered alone
    expect(readiness.shoulderIrritation).toBe(1);
    expect(readiness.sleepHours).toBe(8);
  });

  it('never rewrites a historical exerciseId', () => {
    const result = migrateTo(v4State(), 4, 7);
    expect(result.sessionLogs['2026-02-16:main'].exercises[0].exerciseId).toBe('ring-dip');
  });

  it('leaves sessions with no readiness alone rather than inventing one', () => {
    const noReadiness = v4State();
    delete (noReadiness.sessionLogs['2026-02-16:main'] as { readiness?: unknown }).readiness;
    expect(migrateTo(noReadiness, 4, 7).sessionLogs['2026-02-16:main'].readiness).toBeUndefined();
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
          phase: 'build1',
          day: 'mon',
          block: 'main',
          startedAt: '2026-01-05T08:00:00.000Z',
          exercises: [
            {
              exerciseId: 'hspu-primary',
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

  it('imports a v1.0-shaped export through every step, then the v6.0 wipe', () => {
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
    // Previous-block data does not survive v8; its last weight seeds the start.
    expect(imported.dailyEntries).toEqual({});
    expect(imported.settings.blockStartDate).toBe(V6_BLOCK_START);
    expect(imported.settings.startWeightKg).toBe(77);
    expect(imported.settings.targetWeightKg).toBe(72.5);
  });
});

// The reset survives a sync only if migrate() leaves settings.updatedAt alone.
// migrate() runs on the remote state on every pull, so re-stamping it made the
// incoming copy always newer than local, mergeState always chose remote, and
// "Reset block" was silently reverted — old blockStartDate back, resetAt gone.
describe('migrate() and settings.updatedAt', () => {
  it('preserves a stored updatedAt rather than re-stamping it', () => {
    const stored = { ...defaultSettings(), updatedAt: '2026-01-01T00:00:00.000Z' };
    const migrated = migrate({ schemaVersion: SCHEMA_VERSION, settings: stored }, SCHEMA_VERSION);
    expect(migrated.settings.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('backfills updatedAt when the stored settings predate the field', () => {
    const legacy = { blockStartDate: '2026-01-05', startWeightKg: 77 };
    const migrated = migrate({ schemaVersion: 1, settings: legacy }, 1);
    expect(typeof migrated.settings.updatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(migrated.settings.updatedAt))).toBe(false);
  });

  it('keeps resetAt and blockStartDate through a migrate round trip', () => {
    const stored = {
      ...defaultSettings(),
      blockStartDate: '2026-08-31',
      resetAt: '2026-08-31T09:00:00.000Z',
      updatedAt: '2026-08-31T09:00:00.000Z',
    };
    const migrated = migrate({ schemaVersion: SCHEMA_VERSION, settings: stored }, SCHEMA_VERSION);
    expect(migrated.settings.blockStartDate).toBe('2026-08-31');
    expect(migrated.settings.resetAt).toBe('2026-08-31T09:00:00.000Z');
    expect(migrated.settings.updatedAt).toBe('2026-08-31T09:00:00.000Z');
  });
});

// ---- v7 -> v8: the v6.0 Cut to New Year wipe (SPEC-V6.0.md section 8) ----
describe('migrate v7 -> v8', () => {
  const before = '2026-10-01T08:00:00.000Z';
  const after = '2026-10-12T08:00:00.000Z';

  function v7State() {
    return {
      schemaVersion: 7,
      settings: {
        ...defaultSettings(),
        blockStartDate: '2026-09-14',
        startWeightKg: 80,
        targetWeightKg: 73,
        weightUnit: 'lbs' as const,
        resetAt: '2026-09-14T09:00:00.000Z',
        updatedAt: '2026-09-20T09:00:00.000Z',
      },
      dailyEntries: {
        '2026-10-05': { date: '2026-10-05', weightKg: 78, updatedAt: before },
        '2026-10-06': { date: '2026-10-06', weightKg: 77.8, updatedAt: before },
        '2026-10-07': { date: '2026-10-07', weightKg: 77.6, updatedAt: before },
        '2026-10-08': { date: '2026-10-08', weightKg: 77.6, updatedAt: before },
        '2026-10-11': { date: '2026-10-11', weightKg: 77.4, updatedAt: '2026-10-11T07:00:00.000Z' },
      },
      sessionLogs: {
        '2026-10-05:main': {
          id: '2026-10-05:main',
          date: '2026-10-05',
          week: 4,
          phase: 'accumulation',
          day: 'mon',
          block: 'main',
          startedAt: before,
          updatedAt: before,
          exercises: [],
        },
        '2026-10-12:main': {
          id: '2026-10-12:main',
          date: '2026-10-12',
          week: 1,
          phase: 'reentry',
          day: 'mon',
          block: 'main',
          startedAt: after,
          updatedAt: after,
          exercises: [],
        },
      },
      benchmarkEntries: { '1': { date: '2026-09-20', week: 1, values: {}, updatedAt: before } },
      progressionEvents: [{ id: 'p', date: '2026-09-30', exerciseId: 'ring-dip', axis: 'a', from: 'x', to: 'y' }],
      decisionEntries: {},
      caseStudyProtocol: null,
    };
  }

  it('starts the new block on 11 October 2026', () => {
    expect(migrate(v7State(), 7).settings.blockStartDate).toBe('2026-10-11');
  });

  it('wipes every previous-block record', () => {
    const result = migrate(v7State(), 7);
    expect(result.sessionLogs['2026-10-05:main']).toBeUndefined();
    expect(result.dailyEntries['2026-10-05']).toBeUndefined();
    expect(result.benchmarkEntries).toEqual({});
    expect(result.progressionEvents).toEqual([]);
    expect(result.settings.resetAt).toBeUndefined();
  });

  it('keeps day-1 weigh-ins and anything the v6 build wrote after the cutoff', () => {
    const result = migrate(v7State(), 7);
    expect(result.dailyEntries['2026-10-11'].weightKg).toBe(77.4);
    expect(result.sessionLogs['2026-10-12:main'].phase).toBe('build1');
  });

  it("seeds the start weight from the previous block's last 7-day average", () => {
    // mean of 78, 77.8, 77.6, 77.6 = 77.75 -> 77.8 (one decimal)
    expect(migrate(v7State(), 7).settings.startWeightKg).toBe(77.8);
  });

  it('carries the weight unit and target weight, and stamps updatedAt with the fixed cutoff', () => {
    const settings = migrate(v7State(), 7).settings;
    expect(settings.weightUnit).toBe('lbs');
    expect(settings.targetWeightKg).toBe(73);
    expect(settings.updatedAt).toBe(V6_WIPE_CUTOFF);
  });

  it('is deterministic, so a remote copy migrates to exactly what the local one did', () => {
    expect(migrate(v7State(), 7)).toEqual(migrate(v7State(), 7));
  });

  it('does not wipe again once the state is at v8', () => {
    const once = migrate(v7State(), 7);
    expect(migrate(once, SCHEMA_VERSION)).toEqual(once);
  });
});
