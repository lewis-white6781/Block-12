// End-of-block benchmarks — SPEC-V5.0.md section 9. Rendered as a week-12 checklist.
//
// Item ORDER is load-bearing: review.ts's checkEndOfBlockTargets matches on
// `group.id` plus the item's index to decide which items it can auto-check.
// Reordering an item silently moves its check onto a different claim.

export interface TargetGroup {
  id: string;
  label: string;
  items: string[];
}

export const targets: TargetGroup[] = [
  {
    id: 'body',
    label: 'Body composition',
    items: [
      'at target weight', // auto: settings.targetWeightKg
      'waist measurably smaller',
      'standardised photos taken and compared',
    ],
  },
  {
    id: 'hspu',
    label: 'HSPU & handstand',
    items: [
      'more ROM or reps in the primary pike HSPU', // auto: week 1 -> week 12
      'more reps or ROM in the wall-assisted HSPU', // auto
      'more consistent wall-release balance',
    ],
  },
  {
    id: 'frontLever',
    label: 'Front lever',
    items: [
      'hardest clean 5–8 s progression at open advanced tuck or beyond', // auto
      'less band assistance needed for the full shape',
      'harder front-lever raise leverage',
      'less assistance on the front-lever pull',
    ],
  },
  {
    id: 'strength',
    label: 'Strength',
    items: [
      'weighted ring dip load held for 4–6 clean reps', // auto: >= 95% of block best
      'weighted pull-up load held for 3–5 clean reps', // auto: >= 95% of block best
      'hack squat performance held', // auto: >= 95% of block best
    ],
  },
  {
    id: 'core',
    label: 'Core',
    items: [
      'harder dragon flag progression', // auto
      'deeper standing rollout', // auto
      'harder windshield-wiper progression', // auto
    ],
  },
  {
    id: 'flexibility',
    label: 'Flexibility',
    items: [
      'measured progress across the six chains', // auto, week 1 -> week 12
      'pancake sternum closer to the floor',
      'middle and front split pelvis closer to the floor',
      'better shoulder-flexion wall test and bridge',
    ],
  },
  {
    id: 'cardio',
    label: 'Cardio',
    items: [
      'moderate session built to 30 min', // auto
      'eight quality HIIT intervals established', // auto
      'long session built to 80+ min', // auto
      'more output at the same RPE across all three sessions',
    ],
  },
];
