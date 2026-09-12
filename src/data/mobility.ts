// Flexibility benchmarks + weekly progression variable — SPEC-V5.0.md section 6.

/**
 * The weeks the six flexibility benchmarks are measured in.
 *
 * v5.0: week 1 for the baseline and week 12 for the comparison — both
 * flexibility sessions name week 12 as "+ benchmark" (SPEC-V5.0.md section 6).
 * There is no mid-block test: week 6 is the deload and the plan says to
 * maintain positions there rather than chase ROM, which a measurement would
 * invite.
 */
export const BENCHMARK_WEEKS = [1, 12];

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
 * One measurement per flexibility chain in SPEC-V5.0.md section 6.
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
 * v5.0 follows the block's single arc: the flexibility set and RPE tables
 * (SPEC-V5.0.md section 6) climb from RPE 6 to 7–7.5, halve in the week-6
 * deload, and drop to an easy benchmark week at 12. The axis to move is
 * always ROM → control → load, in that order.
 */
export const weeklyProgressionVariables: WeeklyProgressionVariable[] = [
  { week: 1, description: 're-entry — establish honest RPE 6 positions, measure the six benchmarks' },
  { week: 2, description: 're-entry — same positions, better control' },
  { week: 3, description: 'accumulation — a third loaded set; increase usable ROM slightly' },
  { week: 4, description: 'accumulation — RPE 7; hold the new ROM under control' },
  { week: 5, description: 'accumulation — a third static set; ROM before load' },
  { week: 6, description: 'deload — roughly half volume, RPE 5–6, maintain positions rather than chasing ROM' },
  { week: 7, description: 'intensification — resume at RPE 6.5 from the pre-deload positions' },
  { week: 8, description: 'intensification — RPE 7; modest external load where control is proven' },
  { week: 9, description: 'intensification — three sets of everything; lower supports' },
  { week: 10, description: 'intensification — RPE 7–7.5 strong end-range work, still relaxed' },
  { week: 11, description: 'realization — hold the best positions of the block at RPE 7–7.5' },
  { week: 12, description: 'consolidation — easy volume, re-measure all six benchmarks' },
];

// Shown as a checklist under the weekly progression variable. Folds in
// SPEC-V5.0.md section 7's joint/tendon rule — flexibility work is not where a
// cut should be earning injuries.
export const doNotProgressConditions: string[] = [
  'spine compensates excessively',
  'joint feels pinched',
  'active control disappears',
  'soreness affects the main strength session',
  'sharp pain, or pain that changes how you move',
  'tendon pain that increases through the warm-up',
];
