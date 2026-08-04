// Exercise lookup — SPEC-V3.0.md section 3.
//
// One rule, and the whole reason this module exists:
//
//   Resolving an exerciseId that came out of a LOG goes through lookupExercise.
//   Building the list of exercises to PRESCRIBE reads `program` directly.
//
// A logged id may name a retired exercise; a prescribed one never may. Keeping
// the two lookups textually distinct is what stops a retired movement quietly
// reappearing in a session.
import { program } from './program';
import { retiredExercises } from './retiredExercises';
import type { Exercise } from '../domain/types';

const byId = new Map<string, Exercise>();
for (const exercise of [...program, ...retiredExercises]) {
  byId.set(exercise.id, exercise);
}

/** Every exercise the app can name, current and retired. Not a prescription source. */
export const allKnownExercises: Exercise[] = [...program, ...retiredExercises];

/** Resolves an exerciseId from a log. Returns undefined for an id from neither list. */
export function lookupExercise(id: string): Exercise | undefined {
  return byId.get(id);
}

/** Display name for a logged exerciseId, falling back to the raw id. */
export function exerciseName(id: string): string {
  return byId.get(id)?.name ?? id;
}

/** True if this id names an exercise no longer in the program. */
export function isRetired(id: string): boolean {
  return retiredExercises.some((e) => e.id === id);
}
