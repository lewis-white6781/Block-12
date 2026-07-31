import { describe, expect, it } from 'vitest';
import { convertWeight, formatWeight, kgToLbs, lbsToKg, parseWeight } from '../units';

describe('kgToLbs / lbsToKg', () => {
  it('converts kg to lbs and back within floating-point tolerance', () => {
    expect(kgToLbs(1)).toBeCloseTo(2.2046226, 5);
    expect(lbsToKg(2.2046226)).toBeCloseTo(1, 5);
  });
});

describe('convertWeight', () => {
  it('passes kg through unchanged', () => {
    expect(convertWeight(80, 'kg')).toBe(80);
  });

  it('converts kg to lbs', () => {
    expect(convertWeight(1, 'lbs')).toBeCloseTo(2.2046226, 5);
  });
});

describe('parseWeight / formatWeight round-trip', () => {
  it('keeps a typed lbs value stable through storage and back to display', () => {
    const storedKg = parseWeight(165, 'lbs');
    expect(formatWeight(storedKg, 'lbs')).toBe('165.0 lbs');
  });

  it('keeps a typed kg value stable through storage and back to display', () => {
    const storedKg = parseWeight(74.8, 'kg');
    expect(formatWeight(storedKg, 'kg')).toBe('74.8 kg');
  });

  it('round-trips a range of lbs values without drifting to a neighbouring decimal', () => {
    for (const lbs of [100, 120, 135.5, 150, 165, 180, 200.2, 220]) {
      const storedKg = parseWeight(lbs, 'lbs');
      expect(formatWeight(storedKg, 'lbs')).toBe(`${lbs.toFixed(1)} lbs`);
    }
  });

  it('does not convert when the unit is kg', () => {
    expect(formatWeight(80, 'kg')).toBe('80.0 kg');
  });
});
