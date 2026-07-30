// Mobility benchmarks + weekly progression variable — SPEC.md section 5.9.

export type BenchmarkDirection = 'higher-better' | 'lower-better';

export interface BenchmarkDefinition {
  id: string;
  label: string;
  unit: 'cm' | 'degrees';
  direction: BenchmarkDirection;
  targetNote?: string;
}

export const benchmarks: BenchmarkDefinition[] = [
  {
    id: 'kneeToWall',
    label: 'Knee-to-wall dorsiflexion',
    unit: 'cm',
    direction: 'higher-better',
    targetNote: 'target +2 to +4',
  },
  {
    id: 'pikeReach',
    label: 'Standardised pike reach',
    unit: 'cm',
    direction: 'higher-better',
    targetNote: 'target +5 to +10',
  },
  {
    id: 'pancakeTorso',
    label: 'Pancake torso height off floor',
    unit: 'cm',
    direction: 'lower-better',
  },
  {
    id: 'shoulderLiftOff',
    label: 'Wall shoulder-flexion lift-off',
    unit: 'cm',
    direction: 'higher-better',
  },
  {
    id: 'hip9090',
    label: 'Active 90/90 internal rotation',
    unit: 'degrees',
    direction: 'higher-better',
  },
  {
    id: 'wristLean',
    label: 'Wrist lean distance, no discomfort',
    unit: 'cm',
    direction: 'higher-better',
  },
];

export interface WeeklyProgressionVariable {
  week: number;
  description: string;
}

// Exactly one shown per week; a second axis is blocked from logging.
export const weeklyProgressionVariables: WeeklyProgressionVariable[] = [
  { week: 1, description: 'establish baseline' },
  { week: 2, description: 'add 1–2 reps or 5 s' },
  { week: 3, description: 'increase ROM slightly' },
  { week: 4, description: 'add 2–3 s active end-range pauses' },
  { week: 5, description: 'add small load or harder leverage' },
  { week: 6, description: 'half volume, re-test' },
  { week: 7, description: 'resume from improved baseline' },
  { week: 8, description: 'add active repetitions' },
  { week: 9, description: 'increase ROM' },
  { week: 10, description: 'increase leverage or load' },
  { week: 11, description: 'reduce volume 30–40%' },
  { week: 12, description: 'final testing' },
];

// Shown as a checklist under the weekly progression variable.
export const doNotProgressConditions: string[] = [
  'spine compensates excessively',
  'joint feels pinched',
  'active control disappears',
  'soreness affects the main strength session',
];
