// RETIRED EXERCISES — SPEC-V3.0.md section 3.
//
// Exercises that were once prescribed and have since been replaced. They are
// removed from `program` so they are never prescribed again, but kept here
// verbatim so historical logs stay readable: a Monday logged in week 2 must
// still name its exercises correctly in Progress, Review and the CSV export
// after the programming changes underneath it.
//
// The rules:
//   - Entries here are NEVER prescribed. Nothing that builds a day's exercise
//     list may read this file — use `program` for that.
//   - Historical `SetLog`s are NEVER rewritten to a new exerciseId. The whole
//     point is that old data keeps meaning what it meant when it was logged.
//   - Move the record here byte-for-byte as it last stood in program.ts,
//     prescriptions and all, and add a `// retired in vX.Y:` note saying why.
//
// This is the general mechanism for any mid-block programming change, not a
// one-off for the v3.0 Monday swap.
import type { Exercise } from '../domain/types';

export const retiredExercises: Exercise[] = [];
