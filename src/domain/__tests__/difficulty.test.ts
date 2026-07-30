import { describe, expect, it } from 'vitest';
import { effectiveLevel, effectiveLevelForSet, romBonusFor, TUNING } from '../difficulty';
import type { Exercise, Ladder, SetLog } from '../types';

describe('effectiveLevel', () => {
  it('applies the assistance penalty and rom bonus per SPEC.md 6.2', () => {
    expect(effectiveLevel(3, 0)).toBe(3);
    expect(effectiveLevel(3, 1)).toBeCloseTo(3 - TUNING.assistancePenalty, 5);
    expect(effectiveLevel(3, 2, 0.5)).toBeCloseTo(3 - 2 * TUNING.assistancePenalty + 0.5, 5);
  });

  it('clamps to >= 0', () => {
    expect(effectiveLevel(0, 3)).toBe(0);
    expect(effectiveLevel(1, 5, -2)).toBe(0);
  });
});

describe('romBonusFor', () => {
  it('is -0.5 when the set is flagged partialROM, else 0', () => {
    const flagged: Pick<SetLog, 'techniqueFlags'> = { techniqueFlags: ['partialROM'] };
    const clean: Pick<SetLog, 'techniqueFlags'> = { techniqueFlags: [] };
    expect(romBonusFor(flagged)).toBe(TUNING.partialRomPenalty);
    expect(romBonusFor(clean)).toBe(0);
  });
});

describe('effectiveLevelForSet', () => {
  const ladder: Ladder = {
    id: 'frontLever',
    assistanceTiers: ['none', 'light band', 'medium band', 'heavy band'],
    variants: [
      { id: 'tuck', label: 'tuck', level: 0 },
      { id: 'one-leg', label: 'one-leg', level: 3 },
    ],
  };
  const exercise = { id: 'fl-hard-iso', ladderId: 'frontLever' } as Exercise;

  it('looks up the variant level and applies assistance + rom bonus', () => {
    const set = { variantId: 'one-leg', assistanceTier: 1, techniqueFlags: [] } as unknown as SetLog;
    expect(effectiveLevelForSet(exercise, ladder, set)).toBeCloseTo(3 - TUNING.assistancePenalty, 5);
  });

  it('falls back to level 0 when there is no ladder or no variant snapshot', () => {
    const set = { techniqueFlags: [] } as unknown as SetLog;
    expect(effectiveLevelForSet(exercise, undefined, set)).toBe(0);
    expect(effectiveLevelForSet(exercise, ladder, set)).toBe(0);
  });
});
