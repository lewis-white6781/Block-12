// End-of-block checklist — SPEC-V6.0.md section 9. Shown in Review from week 10.
//
// The Cut to New Year plan states no end-of-block goals of its own beyond the
// cut itself and a "Peak + test" fortnight (weeks 9–10). So the checklist is
// exactly that: the target weight, and every ★ exercise tested in weeks 9–10
// against its week-1 best. Nothing else is claimed.
//
// Item ORDER is load-bearing: review.ts's checkEndOfBlockTargets matches on
// `group.id` plus the item's index to decide which items it can auto-check.
// Reordering an item silently moves its check onto a different claim.

export interface TargetGroup {
  id: string;
  label: string;
  items: string[];
}

/**
 * The ★ exercises, in the order the `test` group lists them. review.ts reads
 * this to resolve each test item to its exercise.
 */
export const PEAK_TEST_EXERCISE_IDS = [
  'hspu-primary',
  'ring-dip',
  'ring-pullup',
  'fl-hold-primary',
  'fl-raise',
  'fl-row-banded',
  'trap-bar-deadlift',
  'bulgarian-split-squat',
];

export const PEAK_TEST_WEEKS = [9, 10];

export const targets: TargetGroup[] = [
  {
    id: 'body',
    label: 'Body composition',
    items: [
      'at target weight', // auto: settings.targetWeightKg
    ],
  },
  {
    id: 'test',
    label: 'Peak test (weeks 9–10) beats week 1',
    items: [
      'Primary HSPU', // auto, PEAK_TEST_EXERCISE_IDS[0]
      'Weighted ring dip', // auto
      'Weighted pull-up', // auto
      'Hard front lever hold', // auto
      'Front lever raise or straddle negative', // auto
      'Band-assisted front lever row', // auto
      'Trap bar deadlift', // auto
      'Deep rear-foot-elevated split squat', // auto
    ],
  },
];
