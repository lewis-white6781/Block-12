import { describe, expect, it } from 'vitest';
import {
  autoregulationAdjustment,
  elbowVolumeWarning,
  isElbowWarningDay,
  isShoulderWarningDay,
  optionalRunGate,
  shoulderVolumeWarning,
} from '../readiness';
import type { Readiness, SessionLog, SetLog } from '../types';

function readiness(overrides: Partial<Readiness> = {}): Readiness {
  return { sleepHours: 8, soreness: 0, elbowIrritation: 0, shoulderIrritation: 0, motivation: 3, ...overrides };
}

function set(overrides: Partial<SetLog> = {}): SetLog {
  return { id: 'x', techniqueFlags: [], score: 0, ...overrides };
}

function sprintSession(date: string, distanceM: number, intensityPct: number, overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: `${date}:main`,
    date,
    week: 4,
    phase: 'accumulation',
    day: 'wed',
    block: 'main',
    startedAt: date,
    completedAt: date,
    exercises: [{ exerciseId: 'sprints', sets: [set({ distanceM, intensityPct })] }],
    updatedAt: date,
    ...overrides,
  };
}

describe('autoregulationAdjustment', () => {
  it('drops RPE 0.5 when sleep < 6h', () => {
    expect(autoregulationAdjustment(readiness({ sleepHours: 5 }))).toEqual({
      rpeDelta: -0.5,
      message: 'Adjusted for recovery',
    });
  });

  it('drops RPE 0.5 when soreness is 3', () => {
    expect(autoregulationAdjustment(readiness({ soreness: 3 }))?.rpeDelta).toBe(-0.5);
  });

  it('does nothing when well-rested and not sore', () => {
    expect(autoregulationAdjustment(readiness())).toBeNull();
  });
});

describe('elbowVolumeWarning / shoulderVolumeWarning', () => {
  it('fires after two consecutive check-ins at elbowIrritation >= 2', () => {
    const result = elbowVolumeWarning([readiness({ elbowIrritation: 2 }), readiness({ elbowIrritation: 3 })]);
    expect(result?.message).toBe('Reduce lever and curl volume this session.');
    expect(result?.suggestedExerciseIds).toContain('fl-hard-iso');
  });

  it('does not fire on a single elevated check-in', () => {
    expect(elbowVolumeWarning([readiness({ elbowIrritation: 2 }), readiness({ elbowIrritation: 0 })])).toBeNull();
  });

  it('shoulder variant checks shoulderIrritation independently', () => {
    const result = shoulderVolumeWarning([readiness({ shoulderIrritation: 2 }), readiness({ shoulderIrritation: 2 })]);
    expect(result?.suggestedExerciseIds).toContain('ring-dip');
  });
});

describe('isElbowWarningDay / isShoulderWarningDay', () => {
  it('elbow banner is Tuesday/Friday', () => {
    expect(isElbowWarningDay('tue')).toBe(true);
    expect(isElbowWarningDay('fri')).toBe(true);
    expect(isElbowWarningDay('mon')).toBe(false);
  });

  it('shoulder banner is Monday/Saturday', () => {
    expect(isShoulderWarningDay('mon')).toBe(true);
    expect(isShoulderWarningDay('sat')).toBe(true);
    expect(isShoulderWarningDay('wed')).toBe(false);
  });
});

describe('optionalRunGate', () => {
  const healthyReadiness = [readiness({ soreness: 0, sleepHours: 8, motivation: 3 }), readiness({ soreness: 1, sleepHours: 7.5 }), readiness({ soreness: 0, sleepHours: 7 })];

  it('is ineligible before week 3 even if every condition passes', () => {
    const sessionLogs = {
      'w1:main': sprintSession('2026-01-07', 100, 95),
      'w2:main': sprintSession('2026-01-14', 100, 95),
      'w3:main': sprintSession('2026-01-21', 100, 95),
    };
    const result = optionalRunGate({ week: 2, sessionLogs, recentReadiness: healthyReadiness, weeklyRatePct: -0.4 });
    expect(result.eligible).toBe(false);
  });

  it('is eligible when all four conditions pass from week 3 on', () => {
    const sessionLogs = {
      'w1:main': sprintSession('2026-01-07', 100, 95),
      'w2:main': sprintSession('2026-01-14', 100, 95),
      'w3:main': sprintSession('2026-01-21', 100, 95),
    };
    const result = optionalRunGate({ week: 4, sessionLogs, recentReadiness: healthyReadiness, weeklyRatePct: -0.4 });
    expect(result.conditions.every((c) => c.met)).toBe(true);
    expect(result.eligible).toBe(true);
  });

  it('fails the sprint condition when the latest session is well off recent best', () => {
    const sessionLogs = {
      'w1:main': sprintSession('2026-01-07', 100, 95),
      'w2:main': sprintSession('2026-01-14', 100, 95),
      'w3:main': sprintSession('2026-01-21', 50, 80),
    };
    const result = optionalRunGate({ week: 4, sessionLogs, recentReadiness: healthyReadiness, weeklyRatePct: -0.4 });
    expect(result.conditions.find((c) => c.id === 'sprint')?.met).toBe(false);
    expect(result.eligible).toBe(false);
  });

  it('fails the rate condition when weekly rate is out of bounds', () => {
    const sessionLogs = { 'w1:main': sprintSession('2026-01-07', 100, 95) };
    const result = optionalRunGate({ week: 4, sessionLogs, recentReadiness: healthyReadiness, weeklyRatePct: -1.2 });
    expect(result.conditions.find((c) => c.id === 'rate')?.met).toBe(false);
  });

  it('fails the sleep/motivation condition on low sleep', () => {
    const sessionLogs = {
      'w1:main': sprintSession('2026-01-07', 100, 95),
      'w2:main': sprintSession('2026-01-14', 100, 95),
      'w3:main': sprintSession('2026-01-21', 100, 95),
    };
    const tiredReadiness = [readiness({ sleepHours: 5 }), readiness({ sleepHours: 5 }), readiness({ sleepHours: 5 })];
    const result = optionalRunGate({ week: 4, sessionLogs, recentReadiness: tiredReadiness, weeklyRatePct: -0.4 });
    expect(result.conditions.find((c) => c.id === 'sleep')?.met).toBe(false);
  });
});
