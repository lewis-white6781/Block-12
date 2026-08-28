// Flexibility benchmarks + weekly progression variable — SPEC-V4.0.md section 6.

/**
 * The weeks the six flexibility benchmarks are measured in.
 *
 * v4.0 moved the mid-block test from week 6 to week 8. Under the three-wave
 * model week 6 is an overload week — measuring end-range flexibility on the
 * back of the heaviest gym week of wave 2 tests fatigue, not flexibility.
 * Weeks 4, 8 and 12 are the deloads; 8 is the one nearest the middle.
 */
export const BENCHMARK_WEEKS = [1, 8, 12];

export function isBenchmarkWeek(week: number): boolean {
  return BENCHMARK_WEEKS.includes(week);
}

export type BenchmarkDirection = 'higher-better' | 'lower-better';

export interface BenchmarkDefinition {
  id: string;
  label: string;
  unit: 'cm' | 'degrees';
  direction: BenchmarkDirection;
  targetNote?: string;
}

/**
 * One measurement per flexibility chain in SPEC-V4.0.md section 6.
 *
 * Every one is a distance in centimetres from a body landmark to the floor or
 * past a reference point, because that is what can be re-measured months apart
 * without a protractor and without arguing about it. Three of the six are
 * lower-better: they measure how far you still are from the floor.
 */
export const benchmarks: BenchmarkDefinition[] = [
  {
    id: 'pancakeTorso',
    label: 'Pancake — chest height off floor',
    unit: 'cm',
    direction: 'lower-better',
    targetNote: 'chest-to-floor pancake is 0',
  },
  {
    id: 'middleSplitHip',
    label: 'Middle split — hip height off floor',
    unit: 'cm',
    direction: 'lower-better',
  },
  {
    id: 'frontSplitHip',
    label: 'Front split — rear hip height off floor',
    unit: 'cm',
    direction: 'lower-better',
    targetNote: 'measure the same side each time',
  },
  {
    id: 'pikeReach',
    label: 'Pike — reach past the toes',
    unit: 'cm',
    direction: 'higher-better',
    targetNote: 'negative until the fingertips pass the feet',
  },
  {
    id: 'shoulderLiftOff',
    label: 'Wall shoulder-flexion lift-off',
    unit: 'cm',
    direction: 'higher-better',
  },
  {
    id: 'bridgeShoulder',
    label: 'Bridge — shoulders past the hands',
    unit: 'cm',
    direction: 'higher-better',
  },
];

export interface WeeklyProgressionVariable {
  week: number;
  description: string;
}

/**
 * The one thing to move this week. Exactly one is shown, and a second axis is
 * blocked from logging (the one-variable rule).
 *
 * v4.0 rewrites these to follow the three loading waves — deloads at 4, 8 and
 * 12 — rather than the old single arc with its lone week-6 deload.
 */
export const weeklyProgressionVariables: WeeklyProgressionVariable[] = [
  { week: 1, description: 'wave 1 — establish baseline ROM, measure the six benchmarks' },
  { week: 2, description: 'wave 1 — same positions, better control' },
  { week: 3, description: 'wave 1 overload — increase ROM slightly' },
  { week: 4, description: 'wave 1 deload — half volume, easy RPE 5–6' },
  { week: 5, description: 'wave 2 — rebuild to week 3\'s ROM' },
  { week: 6, description: 'wave 2 overload — add 2–3 s active end-range pauses' },
  { week: 7, description: 'wave 2 peak — add small load or harder leverage' },
  { week: 8, description: 'wave 2 deload — half volume, re-measure the benchmarks' },
  { week: 9, description: 'wave 3 — resume from the improved baseline' },
  { week: 10, description: 'wave 3 — increase ROM' },
  { week: 11, description: 'wave 3 — hold ROM, reduce volume as mileage peaks' },
  { week: 12, description: 'final measurement, easy volume only' },
];

// Shown as a checklist under the weekly progression variable. v4.0 folds in
// SPEC-V4.0.md section 7's joint/tendon rule — the flexibility work is not
// where a marathon block should be earning injuries.
export const doNotProgressConditions: string[] = [
  'spine compensates excessively',
  'joint feels pinched',
  'active control disappears',
  'soreness affects the main strength session',
  'sharp pain, or pain that changes how you move',
  'tendon pain that increases through the warm-up',
];
