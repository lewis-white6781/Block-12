import { describe, expect, it } from 'vitest';
import { autoregulationAdjustment, jointVolumeWarning, jointVolumeWarnings } from '../readiness';
import type { Readiness } from '../types';

function readiness(overrides: Partial<Readiness> = {}): Readiness {
  return {
    sleepHours: 8,
    soreness: 0,
    elbowIrritation: 0,
    shoulderIrritation: 0,
    achillesIrritation: 0,
    motivation: 3,
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

// The day→joint mapping is derived from `program`, so the day-specific cases
// live in data/__tests__/program.test.ts alongside the content they depend on.
// What is asserted here is the rule itself.
describe('jointVolumeWarning', () => {
  it('needs two check-ins before it will fire', () => {
    expect(jointVolumeWarning('shoulder', 'mon', [readiness({ shoulderIrritation: 3 })])).toBeNull();
    expect(jointVolumeWarning('shoulder', 'mon', [])).toBeNull();
  });

  it('does not fire on a single elevated check-in', () => {
    const result = jointVolumeWarning('shoulder', 'mon', [
      readiness({ shoulderIrritation: 3 }),
      readiness({ shoulderIrritation: 0 }),
    ]);
    expect(result).toBeNull();
  });

  it('reads each joint independently', () => {
    const elbowSore = [readiness({ elbowIrritation: 2 }), readiness({ elbowIrritation: 2 })];
    expect(jointVolumeWarning('shoulder', 'mon', elbowSore)).toBeNull();
    expect(jointVolumeWarning('achilles', 'thu', elbowSore)).toBeNull();
  });

  it('stays silent on a day that does not load the joint', () => {
    const shoulderSore = [readiness({ shoulderIrritation: 3 }), readiness({ shoulderIrritation: 3 })];
    // Thursday is a single easy run — nothing on it presses.
    expect(jointVolumeWarning('shoulder', 'thu', shoulderSore)).toBeNull();
    expect(jointVolumeWarnings('thu', shoulderSore)).toEqual([]);
  });
});
