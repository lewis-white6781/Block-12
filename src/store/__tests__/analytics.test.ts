// v5.1 analytics: migration, merge and export-pack behaviour for the decision
// journal and case-study protocol.
import { describe, expect, it } from 'vitest';
import { defaultPersistedState, defaultSettings, migrate, SCHEMA_VERSION } from '../persist';
import type { PersistedState } from '../persist';
import { mergeState } from '../../sync/merge';
import {
  buildDecisionsCSV,
  buildManifest,
  buildPlannedSessionsCSV,
  buildProtocolMarkdown,
  buildSessionsCSV,
} from '../analysisPack';
import type { CaseStudyProtocol, DecisionEntry } from '../../domain/types';

function decision(id: string, updatedAt: string, patch: Partial<DecisionEntry> = {}): DecisionEntry {
  return {
    id,
    eventDate: '2026-09-08',
    createdAt: '2026-09-08T12:00:00.000Z',
    source: 'manual',
    evidence: 'evidence text',
    ruleVersion: '5.1.0',
    decision: 'manual',
    action: 'held the plan',
    followUpSessions: 3,
    updatedAt,
    ...patch,
  };
}

function protocol(updatedAt: string, version = 1): CaseStudyProtocol {
  return {
    version,
    createdAt: '2026-09-08T09:00:00.000Z',
    question: 'q',
    startDate: '2026-09-07',
    endDate: '2026-11-29',
    anchorExerciseIds: ['ring-dip'],
    primaryOutcomes: 'p',
    baselineWindow: 'weeks 1–2',
    endpointWindow: 'weeks 11–12',
    comparisonRules: 'same variant',
    missingDataRule: 'exclude, never estimate',
    followUpSessions: 3,
    preexistingDataNote: 'none',
    retrospective: false,
    amendments: [],
    updatedAt,
  };
}

function baseState(patch: Partial<PersistedState> = {}): PersistedState {
  return { ...defaultPersistedState(), ...patch };
}

describe('migrate v6 -> v7', () => {
  it('adds empty analytics collections to an old export', () => {
    const old = {
      schemaVersion: 6,
      settings: defaultSettings(),
      dailyEntries: {},
      sessionLogs: {},
      benchmarkEntries: {},
      progressionEvents: [],
    };
    const migrated = migrate(old, 6);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.decisionEntries).toEqual({});
    expect(migrated.caseStudyProtocol).toBeNull();
  });

  it('preserves existing analytics records on re-migration', () => {
    const state = {
      ...baseState(),
      decisionEntries: { d1: decision('d1', '2026-09-08T12:00:00.000Z') },
      caseStudyProtocol: protocol('2026-09-08T09:00:00.000Z'),
    };
    const migrated = migrate(state, SCHEMA_VERSION);
    expect(Object.keys(migrated.decisionEntries)).toEqual(['d1']);
    expect(migrated.caseStudyProtocol?.version).toBe(1);
  });
});

describe('merge of analytics records', () => {
  it('unions decision entries and lets the newer updatedAt win', () => {
    const local = baseState({
      decisionEntries: {
        d1: decision('d1', '2026-09-08T12:00:00.000Z', { action: 'local' }),
        d2: decision('d2', '2026-09-08T12:00:00.000Z'),
      },
    });
    const remote = baseState({
      decisionEntries: {
        d1: decision('d1', '2026-09-09T12:00:00.000Z', { action: 'remote-newer' }),
        d3: decision('d3', '2026-09-08T12:00:00.000Z'),
      },
    });
    const merged = mergeState(local, remote);
    expect(Object.keys(merged.decisionEntries).sort()).toEqual(['d1', 'd2', 'd3']);
    expect(merged.decisionEntries.d1.action).toBe('remote-newer');
  });

  it('drops remote analytics records older than the reset tombstone', () => {
    const resetAt = '2026-09-10T00:00:00.000Z';
    const local = baseState({
      settings: { ...defaultSettings(), resetAt, updatedAt: '2026-09-10T00:00:01.000Z' },
    });
    const remote = baseState({
      settings: { ...defaultSettings(), updatedAt: '2026-09-01T00:00:00.000Z' },
      decisionEntries: { d1: decision('d1', '2026-09-08T12:00:00.000Z') },
      caseStudyProtocol: protocol('2026-09-08T09:00:00.000Z'),
    });
    const merged = mergeState(local, remote);
    expect(merged.decisionEntries).toEqual({});
    expect(merged.caseStudyProtocol).toBeNull();
  });

  it('keeps the newer protocol and never drops a local one to a failed remote', () => {
    const local = baseState({ caseStudyProtocol: protocol('2026-09-08T09:00:00.000Z', 1) });
    const remote = baseState({ caseStudyProtocol: protocol('2026-09-09T09:00:00.000Z', 2) });
    expect(mergeState(local, remote).caseStudyProtocol?.version).toBe(2);
    expect(mergeState(local, baseState()).caseStudyProtocol?.version).toBe(1);
  });
});

describe('analysis pack builders', () => {
  it('exports one decisions row per entry with retrospective flagged', () => {
    const csv = buildDecisionsCSV({
      d1: decision('d1', '2026-09-08T12:00:00.000Z'),
      d2: decision('d2', '2026-09-08T12:00:00.000Z', { createdAt: '2026-09-10T12:00:00.000Z' }),
    });
    const rows = csv.split('\n');
    expect(rows).toHaveLength(3);
    expect(rows[1].split(',')[3]).toBe('false'); // contemporaneous
    expect(rows[2].split(',')[3]).toBe('true'); // retrospective
  });

  it('emits a planned-session row for every prescribed slot of all 12 weeks', () => {
    const state = baseState({ settings: { ...defaultSettings(), blockStartDate: '2026-09-07' } });
    const rows = buildPlannedSessionsCSV(state, '2026-09-07').split('\n');
    // Header plus at least one slot per day that prescribes anything — v5.0
    // has main sessions 5 days/week alone, so well over 60 slots in 12 weeks.
    expect(rows.length).toBeGreaterThan(60);
    expect(rows[0]).toBe('date,week,day,block,status');
    // Nothing is logged, so no row may claim completion.
    expect(rows.slice(1).every((r) => r.endsWith('unknown') || r.endsWith('upcoming'))).toBe(true);
  });

  it('sessions CSV has one row per session', () => {
    const state = baseState();
    expect(buildSessionsCSV(state.sessionLogs).split('\n')).toHaveLength(1); // header only
  });

  it('manifest carries demo provenance and protocol version', () => {
    const state = baseState({
      settings: { ...defaultSettings(), demoSeededAt: '2026-09-08T00:00:00.000Z' },
      caseStudyProtocol: protocol('2026-09-08T09:00:00.000Z', 3),
    });
    const manifest = JSON.parse(buildManifest(state, '5.1.0', '2026-09-08'));
    expect(manifest.demoSeededAt).toBe('2026-09-08T00:00:00.000Z');
    expect(manifest.protocolVersion).toBe(3);
    expect(manifest.weeklyCoverage).toHaveLength(12);
  });

  it('protocol markdown states retrospective status honestly', () => {
    const md = buildProtocolMarkdown({ ...protocol('2026-09-08T09:00:00.000Z'), retrospective: true });
    expect(md).toContain('retrospective');
    expect(md).toContain('NOT preregistered');
  });
});
