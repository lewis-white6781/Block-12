// End-of-block targets — SPEC.md section 5.10. Rendered as a week-12 checklist.

export interface TargetGroup {
  id: string;
  label: string;
  items: string[];
}

export const targets: TargetGroup[] = [
  {
    id: 'body',
    label: 'Body',
    items: [
      '72–73 kg',
      'most muscle retained',
      'clearly reduced waist',
      'dip and pull-up performance broadly maintained',
    ],
  },
  {
    id: 'frontLever',
    label: 'Front lever',
    items: [
      'open advanced tuck 10–15 clean s or one-leg 5–8 s/side or noticeably less band assistance on full shape',
      'harder rows with correct hip height',
      'slower, cleaner raises',
    ],
  },
  {
    id: 'handstandHspu',
    label: 'Handstand/HSPU',
    items: [
      'consistent 8–15 s freestanding balances',
      '2 s stable lockout after the press',
      '8–10 elevated pike HSPU at current setup or 4–6 at meaningfully greater ROM',
      'first controlled full or near-full wall HSPU',
    ],
  },
  {
    id: 'pistol',
    label: 'Pistol',
    items: [
      '5–8 clean bodyweight reps/side or 3–5 weighted',
      'improved symmetry',
      'better bottom-position dorsiflexion',
    ],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    items: ['per §5.9 targets'],
  },
  {
    id: 'cardio',
    label: 'Cardio',
    items: [
      'comfortable 50–55 min conversational run',
      'faster, cleaner 20–30 m acceleration',
      'no decline in pistol or sprint performance',
    ],
  },
];
