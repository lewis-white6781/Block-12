import { describe, expect, it } from 'vitest';
import {
  comparableSessionsSince,
  dueFollowUps,
  followUpStatus,
  isRetrospective,
  weekDecisionCounts,
} from '../decisions';
import type { DecisionEntry, SessionLog, SetLog } from '../types';

function qualifyingSet(id: string): SetLog {
  return { id, reps: 8, techniqueFlags: [], score: 8 };
}

function flaggedSet(id: string): SetLog {
  return { id, reps: 8, techniqueFlags: ['usedMomentum'], score: 8 };
}

function sessionWith(date: string, exerciseId: string, sets: SetLog[]): SessionLog {
  return {
    id: `${date}:main`,
    date,
    week: 1,
    phase: 'reentry',
    day: 'mon',
    block: 'main',
    startedAt: `${date}T10:00:00.000Z`,
    exercises: [{ exerciseId, sets }],
    updatedAt: `${date}T10:00:00.000Z`,
  };
}

function entry(patch: Partial<DecisionEntry> = {}): DecisionEntry {
  return {
    id: 'd1',
    eventDate: '2026-09-07',
    createdAt: '2026-09-07T12:00:00.000Z',
    source: 'stagnation',
    exerciseId: 'ring-dip',
    evidence: 'flat 3 sessions at 8 reps',
    ruleVersion: '5.1.0',
    decision: 'accepted',
    action: 'added 2.5 kg',
    followUpSessions: 3,
    updatedAt: '2026-09-07T12:00:00.000Z',
    ...patch,
  };
}

describe('comparableSessionsSince', () => {
  it('counts only sessions after the date with a qualifying set of the exercise', () => {
    const logs = {
      a: sessionWith('2026-09-07', 'ring-dip', [qualifyingSet('s1')]), // same day — excluded
      b: sessionWith('2026-09-09', 'ring-dip', [qualifyingSet('s2')]),
      c: sessionWith('2026-09-11', 'ring-dip', [flaggedSet('s3')]), // no qualifying set
      d: sessionWith('2026-09-12', 'ring-pullup', [qualifyingSet('s4')]), // other exercise
      e: sessionWith('2026-09-14', 'ring-dip', [qualifyingSet('s5')]),
    };
    const result = comparableSessionsSince(logs, 'ring-dip', '2026-09-07');
    expect(result.map((s) => s.date)).toEqual(['2026-09-09', '2026-09-14']);
  });
});

describe('followUpStatus', () => {
  it('waits until the window of comparable sessions has been observed', () => {
    const logs = {
      b: sessionWith('2026-09-09', 'ring-dip', [qualifyingSet('s2')]),
      e: sessionWith('2026-09-11', 'ring-dip', [qualifyingSet('s5')]),
    };
    expect(followUpStatus(entry(), logs, '2026-09-20')).toEqual({
      kind: 'waiting',
      comparableSessions: 2,
      needed: 3,
    });
  });

  it('becomes due once enough comparable sessions exist', () => {
    const logs = {
      b: sessionWith('2026-09-09', 'ring-dip', [qualifyingSet('s2')]),
      c: sessionWith('2026-09-11', 'ring-dip', [qualifyingSet('s3')]),
      e: sessionWith('2026-09-14', 'ring-dip', [qualifyingSet('s5')]),
    };
    expect(followUpStatus(entry(), logs, '2026-09-20')).toEqual({ kind: 'due', comparableSessions: 3 });
  });

  it('uses days for an entry with no linked exercise', () => {
    const noExercise = entry({ exerciseId: undefined, followUpSessions: 7 });
    expect(followUpStatus(noExercise, {}, '2026-09-10').kind).toBe('waiting');
    expect(followUpStatus(noExercise, {}, '2026-09-14').kind).toBe('due');
  });

  it('is recorded once a follow-up exists, regardless of session count', () => {
    const done = entry({
      followUp: {
        recordedAt: '2026-09-15T10:00:00.000Z',
        comparableSessions: 3,
        observation: '8, 9, 9 reps at +12.5 kg',
        outcome: 'improved',
      },
    });
    expect(followUpStatus(done, {}, '2026-09-20')).toEqual({ kind: 'recorded' });
  });
});

describe('dueFollowUps', () => {
  it('returns only due entries, oldest first', () => {
    const logs = {
      b: sessionWith('2026-09-09', 'ring-dip', [qualifyingSet('s2')]),
      c: sessionWith('2026-09-11', 'ring-dip', [qualifyingSet('s3')]),
      e: sessionWith('2026-09-14', 'ring-dip', [qualifyingSet('s5')]),
    };
    const entries = {
      d1: entry(),
      d2: entry({ id: 'd2', eventDate: '2026-09-01', exerciseId: undefined, followUpSessions: 3 }),
      d3: entry({ id: 'd3', exerciseId: 'ring-pullup' }), // no comparable sessions yet
    };
    expect(dueFollowUps(entries, logs, '2026-09-20').map((e) => e.id)).toEqual(['d2', 'd1']);
  });
});

describe('weekDecisionCounts', () => {
  it('reports followed and insufficient-data outcomes as separate facts', () => {
    const entries = {
      d1: entry(),
      d2: entry({ id: 'd2', decision: 'overridden' }),
      d3: entry({
        id: 'd3',
        decision: 'manual',
        followUp: {
          recordedAt: '2026-09-15T10:00:00.000Z',
          comparableSessions: 1,
          observation: 'block ended',
          outcome: 'insufficientData',
        },
      }),
      outside: entry({ id: 'outside', eventDate: '2026-09-20' }),
    };
    const counts = weekDecisionCounts(entries, '2026-09-07', '2026-09-13');
    expect(counts).toEqual({
      total: 3,
      accepted: 1,
      overriddenOrRejected: 1,
      manual: 1,
      followUpsRecorded: 1,
      insufficientOrNotComparable: 1,
    });
  });
});

describe('isRetrospective', () => {
  it('is true only when the entry was written on a later day than its event', () => {
    expect(isRetrospective(entry())).toBe(false);
    expect(isRetrospective(entry({ createdAt: '2026-09-09T01:00:00.000Z' }))).toBe(true);
  });
});
