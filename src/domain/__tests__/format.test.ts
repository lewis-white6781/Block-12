import { describe, expect, it } from 'vitest';
import { MAX_DECIMALS, fmt, fmtPct, fmtSigned, fmtSignedPct, round2, roundTo } from '../format';

function decimalsOf(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  return dot === -1 ? 0 : cleaned.length - dot - 1;
}

describe('round2', () => {
  it('collapses floating-point noise', () => {
    // The exact value WeightChart's corridor band was rendering.
    expect(round2(72.49999999999999)).toBe(72.5);
    expect(round2(169.75574417637)).toBe(169.76);
  });

  it('leaves already-short numbers alone', () => {
    expect(round2(72.5)).toBe(72.5);
    expect(round2(73)).toBe(73);
  });

  it('rounds negatives away from zero at the midpoint boundary consistently', () => {
    expect(round2(-0.425)).toBe(-0.42); // Math.round(-42.5) === -42
    expect(round2(-0.426)).toBe(-0.43);
  });
});

describe('fmt', () => {
  it('never emits more than 2 decimal places, whatever dp is asked for', () => {
    expect(fmt(1.23456789, 6)).toBe('1.23');
    expect(fmt(1.23456789)).toBe('1.23');
    expect(decimalsOf(fmt(1.23456789, 99))).toBeLessThanOrEqual(MAX_DECIMALS);
  });

  it('honours a smaller dp', () => {
    expect(fmt(1.26, 1)).toBe('1.3');
    expect(fmt(1.6, 0)).toBe('2');
  });

  it('pads to the requested dp', () => {
    expect(fmt(80, 1)).toBe('80.0');
    expect(fmt(80)).toBe('80.00');
  });

  it('uses U+2212 for negatives, never an ASCII hyphen', () => {
    expect(fmt(-1.5, 1)).toBe('−1.5');
    expect(fmt(-1.5, 1)).not.toContain('-');
  });

  it('does not render a negative zero', () => {
    expect(fmt(-0.001, 2)).toBe('0.00');
    expect(fmt(-0)).toBe('0.00');
  });
});

describe('fmtSigned', () => {
  it('uses a real minus sign for negatives and a plus for zero and above', () => {
    expect(fmtSigned(-0.42)).toBe('−0.42');
    expect(fmtSigned(1.3, 1)).toBe('+1.3');
    expect(fmtSigned(0)).toBe('+0.00');
  });

  it('signs from the rounded value, so a value that rounds to zero is not "−0.00"', () => {
    expect(fmtSigned(-0.0001)).toBe('+0.00');
  });

  it('caps at 2 dp', () => {
    expect(fmtSigned(-0.123456, 5)).toBe('−0.12');
  });
});

describe('fmtPct / fmtSignedPct', () => {
  it('appends a percent sign and caps at 2 dp', () => {
    expect(fmtPct(-0.5512345)).toBe('−0.55%');
    expect(fmtSignedPct(-0.5512345)).toBe('−0.55%');
    expect(fmtSignedPct(0.5512345)).toBe('+0.55%');
  });
});

describe('roundTo', () => {
  it('clamps dp into 0..2', () => {
    expect(roundTo(1.23456, 9)).toBe(1.23);
    expect(roundTo(1.6, -3)).toBe(2);
  });
});

describe('the global 2 dp guarantee', () => {
  it('holds across a spread of awkward real values', () => {
    const values = [
      0, -0, 1 / 3, -1 / 3, 72.49999999999999, 169.75574417637, 0.1 + 0.2,
      -0.30000000000000004, 1e-9, -1e-9, 12345.6789, -0.575, 2.675,
    ];
    for (const v of values) {
      for (const dp of [0, 1, 2, 3, 8]) {
        expect(decimalsOf(fmt(v, dp))).toBeLessThanOrEqual(MAX_DECIMALS);
        expect(decimalsOf(fmtSigned(v, dp))).toBeLessThanOrEqual(MAX_DECIMALS);
      }
    }
  });
});
