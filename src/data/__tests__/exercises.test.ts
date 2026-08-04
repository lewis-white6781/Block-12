import { describe, expect, it } from 'vitest';
import { allKnownExercises, exerciseName, isRetired, lookupExercise } from '../exercises';
import { program } from '../program';
import { retiredExercises } from '../retiredExercises';

describe('lookupExercise', () => {
  it('resolves a current program exercise', () => {
    expect(lookupExercise('pike-hspu')?.name).toBe('Elevated or deficit pike HSPU');
  });

  it('resolves every retired exercise', () => {
    for (const retired of retiredExercises) {
      expect(lookupExercise(retired.id)).toEqual(retired);
    }
  });

  it('returns undefined for an unknown id rather than throwing', () => {
    expect(lookupExercise('not-a-real-exercise')).toBeUndefined();
  });
});

describe('exerciseName', () => {
  it('falls back to the raw id so a log row is never blank', () => {
    expect(exerciseName('not-a-real-exercise')).toBe('not-a-real-exercise');
  });
});

describe('isRetired', () => {
  it('is false for everything currently in the program', () => {
    for (const exercise of program) {
      expect(isRetired(exercise.id)).toBe(false);
    }
  });

  it('is true for every entry in the registry', () => {
    for (const retired of retiredExercises) {
      expect(isRetired(retired.id)).toBe(true);
    }
  });
});

describe('the registry invariants', () => {
  it('never lists an id that is also in the current program', () => {
    const programIds = new Set(program.map((e) => e.id));
    for (const retired of retiredExercises) {
      expect(programIds.has(retired.id)).toBe(false);
    }
  });

  it('has no duplicate ids across program and registry', () => {
    const ids = allKnownExercises.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
