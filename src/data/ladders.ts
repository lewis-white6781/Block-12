// Variant ladders per skill — SPEC.md section 5.8.
import type { Ladder } from '../domain/types';

const ASSISTANCE_TIERS = ['none', 'light band', 'medium band', 'heavy band'];

export const ladders: Ladder[] = [
  {
    id: 'frontLever',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'tuck', label: 'tuck', level: 0 },
      { id: 'advanced-tuck', label: 'advanced tuck', level: 1 },
      { id: 'open-advanced-tuck', label: 'open advanced tuck', level: 2 },
      { id: 'one-leg', label: 'one-leg', level: 3 },
      { id: 'straddle', label: 'straddle', level: 4 },
      { id: 'half-lay', label: 'half-lay', level: 5 },
      { id: 'full', label: 'full', level: 6 },
    ],
  },
  {
    id: 'hspu',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'floor-pike', label: 'floor pike', level: 0 },
      { id: 'elevated-pike-low', label: 'elevated pike (low)', level: 1 },
      { id: 'elevated-pike-high', label: 'elevated pike (high)', level: 2 },
      { id: 'deficit-pike', label: 'deficit pike', level: 3 },
      { id: 'wall-hspu-partial', label: 'wall HSPU partial ROM', level: 4 },
      { id: 'wall-hspu-full', label: 'wall HSPU full ROM', level: 5 },
      { id: 'wall-hspu-deficit', label: 'wall HSPU deficit', level: 6 },
      { id: 'freestanding-hspu', label: 'freestanding HSPU', level: 7 },
    ],
  },
  {
    id: 'pistol',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'box-pistol-high', label: 'box pistol (high)', level: 0 },
      { id: 'box-pistol-low', label: 'box pistol (low)', level: 1 },
      { id: 'ring-assisted', label: 'ring-assisted', level: 2 },
      { id: 'counterweighted', label: 'counterweighted', level: 3 },
      { id: 'bodyweight', label: 'bodyweight', level: 4 },
      { id: 'weighted', label: 'weighted', level: 5 },
    ],
  },
  {
    id: 'handstandEntry',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'wall-toe-pull', label: 'wall toe pull', level: 0 },
      { id: 'wall-heel-pull', label: 'wall heel pull', level: 1 },
      { id: 'wall-supported-kickup', label: 'wall-supported kick-up', level: 2 },
      { id: 'freestanding-kickup', label: 'freestanding kick-up', level: 3 },
    ],
  },
  {
    id: 'press',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'band-assisted-bent-arm', label: 'band-assisted bent-arm', level: 0 },
      { id: 'unassisted-bent-arm', label: 'unassisted bent-arm', level: 1 },
      { id: 'band-assisted-straight-arm', label: 'band-assisted straight-arm', level: 2 },
      { id: 'unassisted-straight-arm', label: 'unassisted straight-arm', level: 3 },
    ],
  },
];
