import { describe, expect, it } from 'vitest';
import { placeholderSetScore } from '../scoring';

describe('placeholderSetScore', () => {
  it('sums attempt seconds when attempts are present', () => {
    expect(placeholderSetScore({ attempts: [4, 6] })).toBe(10);
  });

  it('falls back to reps', () => {
    expect(placeholderSetScore({ reps: 5 })).toBe(5);
  });

  it('falls back to seconds when no reps', () => {
    expect(placeholderSetScore({ seconds: 8 })).toBe(8);
  });

  it('returns 0 when nothing is present', () => {
    expect(placeholderSetScore({})).toBe(0);
  });
});
