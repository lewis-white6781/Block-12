// End-of-block objectives — SPEC-V4.0.md section 9. Rendered as a week-12 checklist.
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
      'substantially leaner waist',
      'most muscle retained',
      'more visible abdominal definition',
    ],
  },
  {
    id: 'frontLever',
    label: 'Front lever',
    items: [
      'stronger open advanced tuck or one-leg hold', // auto
      'less band assistance on full-shape work',
      'better front-lever row strength',
      'better lever-raise control',
    ],
  },
  {
    id: 'hspu',
    label: 'HSPU & handstand',
    items: [
      'more ROM or reps in the primary pike HSPU', // auto
      'stronger wall-facing negatives',
      'better handstand line',
      'more consistent wall-release balance',
    ],
  },
  {
    id: 'strength',
    label: 'Strength',
    items: [
      'heavy weighted pull-ups maintained', // auto
      'heavy weighted ring dips maintained', // auto
      'major pressing and pulling strength retained',
    ],
  },
  {
    id: 'core',
    label: 'Core',
    items: [
      'stronger dragon flag', // auto
      'harder standing rollout progression', // auto
      'better windshield-wiper control', // auto
      'better anti-lateral trunk strength',
    ],
  },
  {
    id: 'flexibility',
    label: 'Flexibility',
    items: [
      'measured progress across the six chains', // auto, week 1 -> week 12
      'lower pancake position',
      'meaningful progress toward middle and front splits',
      'better overhead handstand shoulder line',
    ],
  },
  {
    id: 'marathon',
    label: 'Marathon development',
    items: [
      'long run built to 2+ hours', // auto
      'comfortable 5–6 run weekly schedule', // auto
      'threshold work held at controlled RPE',
      'strides maintained for speed and mechanics',
    ],
  },
];
