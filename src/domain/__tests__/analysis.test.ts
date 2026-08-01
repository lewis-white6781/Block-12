import { describe, expect, it } from 'vitest';
import {
  checkStopRule,
  churnGuardrails,
  collapseTrainingGuardrails,
  detectStagnation,
  hasProgressionEventThisWeek,
  isFlat,
  isHealthy,
  leverageJumpGuardrails,
  nextProgressionAxis,
  oneVariableWarning,
  phaseRpeCap,
} from '../analysis';
import type { DatedSetScore } from '../scoring';
import type { Exercise, Ladder, ProgressionEvent, Readiness, SessionLog, SetLog } from '../types';

function set(overrides: Partial<SetLog> = {}): SetLog {
  return { id: 'x', techniqueFlags: [], score: 0, ...overrides };
}

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'fl-hard-iso',
    name: 'Hard front-lever isometric',
    day: 'tue',
    block: 'main',
    order: 1,
    metric: 'hold',
    tracked: true,
    cues: [],
    progressionLadder: ['cleaner line', 'greater ROM'],
    stopRules: ['hips sagged', 'elbows unlocked', 'hold time fell >15% vs best'],
    prescriptions: [],
    ...overrides,
  };
}

function readiness(overrides: Partial<Readiness> = {}): Readiness {
  return { sleepHours: 8, soreness: 0, elbowIrritation: 0, shoulderIrritation: 0, motivation: 3, ...overrides };
}

describe('phaseRpeCap', () => {
  it('matches the SPEC.md 6.6 table', () => {
    expect(phaseRpeCap('calibration', 'x')).toBe(7.5);
    expect(phaseRpeCap('accumulation', 'x')).toBe(9);
    expect(phaseRpeCap('deload', 'x')).toBe(6);
    expect(phaseRpeCap('intensification', 'x')).toBe(8.5);
    expect(phaseRpeCap('peak', 'x')).toBe(8.5);
    expect(phaseRpeCap('taper', 'x')).toBe(7.5);
  });

  it('test week is uncapped for the four test lifts, capped 7 otherwise', () => {
    expect(phaseRpeCap('test', 'fl-hard-iso')).toBe(Infinity);
    expect(phaseRpeCap('test', 'ring-pullup')).toBe(Infinity);
    expect(phaseRpeCap('test', 'ring-dip')).toBe(7);
  });
});

describe('checkStopRule', () => {
  const base = {
    exercise: exercise(),
    previousSetThisExercise: undefined,
    rollingBestRaw: null,
    week: 3,
    phase: 'accumulation' as const,
  };

  it('is silent with nothing to flag', () => {
    expect(checkStopRule({ ...base, set: set({ seconds: 6, rpe: 7 }) })).toBeNull();
  });

  it('amber: reps/seconds >=15% below rolling best (acceptance test 11)', () => {
    const result = checkStopRule({ ...base, rollingBestRaw: 10, set: set({ seconds: 8 }) }); // 20% drop
    expect(result).toEqual({ severity: 'amber', message: 'Quality drop. Plan says end this exercise.' });
  });

  it('does not fire the quality-drop banner just under 15%', () => {
    const result = checkStopRule({ ...base, rollingBestRaw: 10, set: set({ seconds: 9 }) }); // 10% drop
    expect(result).toBeNull();
  });

  it('amber: any technique flag, quoting the exercise stop rule when it matches', () => {
    const result = checkStopRule({ ...base, set: set({ seconds: 6, techniqueFlags: ['hipsSagged'] }) });
    expect(result?.severity).toBe('amber');
    expect(result?.message).toContain('Hips sagged');
    expect(result?.message).toContain('hips sagged');
  });

  it('red: two consecutive collapses on a handstand (attempts) exercise', () => {
    const hs = exercise({ id: 'hs-balance-primary', metric: 'attempts' });
    const result = checkStopRule({
      ...base,
      exercise: hs,
      previousSetThisExercise: set({ techniqueFlags: ['collapsed'] }),
      set: set({ techniqueFlags: ['collapsed'] }),
    });
    expect(result).toEqual({ severity: 'red', message: 'Two collapses. Stop balance work today.' });
  });

  it('a single collapse alone is amber, not red', () => {
    const hs = exercise({ id: 'hs-balance-primary', metric: 'attempts' });
    const result = checkStopRule({ ...base, exercise: hs, set: set({ techniqueFlags: ['collapsed'] }) });
    expect(result?.severity).toBe('amber');
  });

  it('amber: RPE 10 outside week 10/12', () => {
    const result = checkStopRule({ ...base, week: 5, set: set({ seconds: 6, rpe: 10 }) });
    expect(result?.message).toContain("fatigue you can't afford");
  });

  it('RPE 10 is silent in week 10 and week 12', () => {
    expect(checkStopRule({ ...base, week: 10, set: set({ seconds: 6, rpe: 10 }) })).toBeNull();
    expect(checkStopRule({ ...base, week: 12, set: set({ seconds: 6, rpe: 10 }) })).toBeNull();
  });

  it('amber: deload/taper RPE over the phase cap', () => {
    const result = checkStopRule({ ...base, phase: 'deload', week: 6, set: set({ seconds: 6, rpe: 7 }) });
    expect(result).toEqual({ severity: 'amber', message: 'Week 6 caps at RPE 6.' });
  });

  it('does not apply the deload/taper cap check outside those phases', () => {
    const result = checkStopRule({ ...base, phase: 'intensification', week: 8, set: set({ seconds: 6, rpe: 9 }) });
    expect(result).toBeNull();
  });
});

describe('isFlat', () => {
  function row(date: string, score: number, qualifies = true): DatedSetScore {
    return { date, week: 1, score, qualifies };
  }

  it('is false with fewer than 4 distinct sessions', () => {
    expect(isFlat([row('2026-01-01', 10), row('2026-01-08', 10), row('2026-01-15', 10)])).toBe(false);
  });

  it('is true when the last 3 sessions have not beaten the prior best by >=3%', () => {
    const history = [
      row('2026-01-01', 10),
      row('2026-01-08', 10.1),
      row('2026-01-15', 10.2),
      row('2026-01-22', 10.1),
    ];
    expect(isFlat(history)).toBe(true);
  });

  it('is false when the recent best beats the prior best by >=3%', () => {
    const history = [
      row('2026-01-01', 10),
      row('2026-01-08', 10),
      row('2026-01-15', 10),
      row('2026-01-22', 10.5),
    ];
    expect(isFlat(history)).toBe(false);
  });
});

describe('isHealthy (acceptance tests 13-14)', () => {
  it('is healthy with 3 good readiness check-ins and consistent weigh-ins', () => {
    const input = {
      exerciseId: 'pike-hspu',
      recentReadiness: [readiness(), readiness(), readiness()],
      daysWithLoggedWeightInLast7: 6,
    };
    expect(isHealthy(input)).toBe(true);
  });

  it('is unhealthy when soreness is 3', () => {
    const input = {
      exerciseId: 'pike-hspu',
      recentReadiness: [readiness({ soreness: 3 }), readiness(), readiness()],
      daysWithLoggedWeightInLast7: 6,
    };
    expect(isHealthy(input)).toBe(false);
  });

  it('is unhealthy when the relevant joint irritation is too high', () => {
    const input = {
      exerciseId: 'pike-hspu', // shoulder-relevant
      recentReadiness: [readiness({ shoulderIrritation: 2 }), readiness(), readiness()],
      daysWithLoggedWeightInLast7: 6,
    };
    expect(isHealthy(input)).toBe(false);
  });

  it('is unhealthy with fewer than 5 of the last 7 days logged', () => {
    const input = {
      exerciseId: 'pike-hspu',
      recentReadiness: [readiness(), readiness(), readiness()],
      daysWithLoggedWeightInLast7: 4,
    };
    expect(isHealthy(input)).toBe(false);
  });
});

describe('detectStagnation (acceptance tests 13-14)', () => {
  const flatHistory: DatedSetScore[] = [
    { date: '2026-01-01', week: 1, score: 10, qualifies: true },
    { date: '2026-01-08', week: 2, score: 10.1, qualifies: true },
    { date: '2026-01-15', week: 3, score: 10.2, qualifies: true },
    { date: '2026-01-22', week: 4, score: 10.1, qualifies: true },
  ];

  it('fires the stagnation card naming the next ladder axis when healthy', () => {
    const result = detectStagnation({
      exercise: exercise({ id: 'pike-hspu', progressionLadder: ['cleaner line', 'greater ROM'] }),
      history: flatHistory,
      health: {
        exerciseId: 'pike-hspu',
        recentReadiness: [readiness(), readiness(), readiness()],
        daysWithLoggedWeightInLast7: 6,
      },
      phase: 'accumulation',
      progressionEvents: [
        { id: 'e1', date: '2026-01-10', exerciseId: 'pike-hspu', axis: 'cleaner line', from: 'a', to: 'b' },
      ],
    });
    expect(result?.type).toBe('stagnant');
    expect(result?.suggestedAxis).toBe('greater ROM');
    expect(result?.message).toContain('greater ROM');
  });

  it('fires the recovery card instead when unhealthy, with no progression suggestion', () => {
    const result = detectStagnation({
      exercise: exercise({ id: 'pike-hspu' }),
      history: flatHistory,
      health: {
        exerciseId: 'pike-hspu',
        recentReadiness: [readiness({ soreness: 3 }), readiness(), readiness()],
        daysWithLoggedWeightInLast7: 6,
      },
      phase: 'accumulation',
      progressionEvents: [],
    });
    expect(result?.type).toBe('recovery');
    expect(result?.suggestedAxis).toBeUndefined();
    expect(result?.outOfRangeReasons).toContain('soreness above target');
  });

  it('is silent during deload/taper', () => {
    const result = detectStagnation({
      exercise: exercise({ id: 'pike-hspu' }),
      history: flatHistory,
      health: {
        exerciseId: 'pike-hspu',
        recentReadiness: [readiness(), readiness(), readiness()],
        daysWithLoggedWeightInLast7: 6,
      },
      phase: 'deload',
      progressionEvents: [],
    });
    expect(result).toBeNull();
  });

  it('is silent when not flat', () => {
    const improving: DatedSetScore[] = [
      { date: '2026-01-01', week: 1, score: 10, qualifies: true },
      { date: '2026-01-08', week: 2, score: 10, qualifies: true },
      { date: '2026-01-15', week: 3, score: 10, qualifies: true },
      { date: '2026-01-22', week: 4, score: 15, qualifies: true },
    ];
    const result = detectStagnation({
      exercise: exercise({ id: 'pike-hspu' }),
      history: improving,
      health: {
        exerciseId: 'pike-hspu',
        recentReadiness: [readiness(), readiness(), readiness()],
        daysWithLoggedWeightInLast7: 6,
      },
      phase: 'accumulation',
      progressionEvents: [],
    });
    expect(result).toBeNull();
  });
});

describe('nextProgressionAxis', () => {
  it('returns the first ladder axis not yet used', () => {
    const ex = exercise({ id: 'pike-hspu', progressionLadder: ['a', 'b', 'c'] });
    const events: ProgressionEvent[] = [{ id: '1', date: '2026-01-01', exerciseId: 'pike-hspu', axis: 'a', from: '', to: '' }];
    expect(nextProgressionAxis(ex, events)).toBe('b');
  });

  it('returns null once every axis has been used', () => {
    const ex = exercise({ id: 'pike-hspu', progressionLadder: ['a'] });
    const events: ProgressionEvent[] = [{ id: '1', date: '2026-01-01', exerciseId: 'pike-hspu', axis: 'a', from: '', to: '' }];
    expect(nextProgressionAxis(ex, events)).toBeNull();
  });
});

describe('one-variable rule (acceptance test 15)', () => {
  const weekOfDate = (date: string) => (date < '2026-01-08' ? 1 : 2);
  const events: ProgressionEvent[] = [
    { id: '1', date: '2026-01-01', exerciseId: 'pike-hspu', axis: 'higher feet', from: 'a', to: 'b' },
  ];

  it('blocks a second event on the same exercise in the same week', () => {
    expect(hasProgressionEventThisWeek(events, 'pike-hspu', 1, weekOfDate)).toBe(true);
    expect(oneVariableWarning(events, 'pike-hspu', 1, weekOfDate)).toContain('higher feet');
  });

  it('allows a second event in a different week', () => {
    expect(hasProgressionEventThisWeek(events, 'pike-hspu', 2, weekOfDate)).toBe(false);
    expect(oneVariableWarning(events, 'pike-hspu', 2, weekOfDate)).toBeNull();
  });
});

describe('tendon guardrails (6.11)', () => {
  it('churnGuardrails fires when an exercise changed more than twice in a 3-week window', () => {
    const events: ProgressionEvent[] = [1, 2, 3].map((n) => ({
      id: String(n),
      date: `2026-0${n}-01`,
      exerciseId: 'pike-hspu',
      axis: 'x',
      from: 'a',
      to: 'b',
    }));
    const weekOfDate = (date: string) => Number(date.slice(6, 7));
    const result = churnGuardrails(events, [exercise({ id: 'pike-hspu' })], weekOfDate, 3);
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('too often');
  });

  it('leverageJumpGuardrails fires when effective level moves by more than 1.0', () => {
    const ladder: Ladder = {
      id: 'frontLever',
      assistanceTiers: ['none'],
      variants: [
        { id: 'tuck', label: 'tuck', level: 0 },
        { id: 'one-leg', label: 'one-leg', level: 3 },
      ],
    };
    const events: ProgressionEvent[] = [
      { id: '1', date: '2026-01-01', exerciseId: 'fl-hard-iso', axis: 'x', from: 'tuck', to: 'one-leg' },
    ];
    const result = leverageJumpGuardrails(events, [exercise({ ladderId: 'frontLever' })], [ladder]);
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('leverage jump');
  });

  it('collapseTrainingGuardrails fires on >=2 collapsed flags on lever holds in one week', () => {
    const flHold = exercise({ ladderId: 'frontLever', metric: 'hold' });
    const sessionLogs: Record<string, SessionLog> = {
      s1: {
        id: 's1',
        date: '2026-01-01',
        week: 3,
        phase: 'accumulation',
        day: 'tue',
        block: 'main',
        startedAt: '2026-01-01T08:00:00.000Z',
        exercises: [
          { exerciseId: 'fl-hard-iso', sets: [set({ techniqueFlags: ['collapsed'] }), set({ techniqueFlags: ['collapsed'] })] },
        ],
        updatedAt: '2026-01-01T08:00:00.000Z',
      },
    };
    const result = collapseTrainingGuardrails(sessionLogs, [flHold], 3);
    expect(result).toHaveLength(1);
  });
});
