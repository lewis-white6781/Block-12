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

export const retiredExercises: Exercise[] = [
  // retired in v3.0: freestanding handstand balance was not trainable at the
  // athlete's current level, so Monday's slot 1 produced no logged data and
  // therefore no progression signal. Replaced by `wall-hspu-partial`
  // (SPEC-V3.0.md section 3). Copied verbatim from program.ts as it last stood.
  {
    id: 'hs-balance-primary',
    name: 'Handstand balance attempts (1 set = 2 attempts)',
    day: 'mon',
    block: 'main',
    order: 1,
    metric: 'attempts',
    ladderId: 'handstandEntry',
    tracked: true,
    cues: [],
    progressionLadder: [],
    stopRules: [],
    prescriptions: [
      { weeks: [1, 2], sets: 4, repsLow: 2, repsHigh: 2, secLow: 3, secHigh: 6, rpeLow: 6, rpeHigh: 7 },
      { weeks: [3, 4, 5], sets: 5, repsLow: 2, repsHigh: 2, secLow: 4, secHigh: 8, rpeLow: 7, rpeHigh: 7 },
      { weeks: [6], sets: 3, repsLow: 2, repsHigh: 2, note: 'easy' },
      { weeks: [7, 8, 9], sets: 5, repsLow: 2, repsHigh: 2, secLow: 5, secHigh: 10, rpeLow: 7, rpeHigh: 8 },
      { weeks: [10], sets: 4, repsLow: 2, repsHigh: 2, note: 'high-quality' },
      { weeks: [11], sets: 3, repsLow: 2, repsHigh: 2 },
      { weeks: [12], sets: 1, repsLow: 3, repsHigh: 5, note: 'rested test attempts' },
    ],
  },

  // retired in v3.0: same reason — the band-assisted bent-arm press was above
  // the athlete's current level. Replaced by `belly-wall-hspu-negative`, the
  // eccentric being the accessible entry to the same bent-arm pressing
  // pattern (SPEC-V3.0.md section 3). Copied verbatim from program.ts.
  {
    id: 'press-to-hs',
    name: 'Band-assisted bent-arm press to handstand',
    day: 'mon',
    block: 'main',
    order: 3,
    metric: 'reps',
    ladderId: 'press',
    tracked: true,
    cues: ['pause 2 s in lockout before lowering'],
    progressionLadder: [],
    stopRules: [],
    prescriptions: [
      { weeks: [1, 2, 3, 4, 5], sets: 3, repsLow: 2, repsHigh: 4, rpeLow: 6, rpeHigh: 7 },
      { weeks: [6], sets: 2, repsLow: 2, repsHigh: 2, note: 'easy' },
      { weeks: [7, 8, 9, 10], sets: 4, repsLow: 1, repsHigh: 3, rpeLow: 7, rpeHigh: 8 },
      { weeks: [11], sets: 2, repsLow: 2, repsHigh: 2 },
      { weeks: [12], sets: 2, note: 'test unassisted press & lockout' },
    ],
  },
];
