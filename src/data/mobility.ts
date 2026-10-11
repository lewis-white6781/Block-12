// Flexibility benchmarks + weekly progression variable — SPEC-V5.0.md section 6,
// emptied by SPEC-V6.0.md section 5.

/**
 * The weeks the six flexibility benchmarks are measured in.
 *
 * v6.0: none. The Cut to New Year plan prescribes no flexibility benchmark, so
 * Today and Review no longer ask for one. The definitions below stay so the
 * BenchmarkForm and any older entries keep rendering.
 */
export const BENCHMARK_WEEKS: number[] = [];

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
 * The one flexibility variable to move each week.
 *
 * v6.0: none. The plan's Mobility + Core session states fixed doses at
 * "Stretch intensity RPE 6–7.5" and its daily mobility is a tick box, so there
 * is no weekly variable to show. v5.0's list described its own block's arc.
 */
export const weeklyProgressionVariables: WeeklyProgressionVariable[] = [];

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
