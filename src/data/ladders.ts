// Variant ladders per skill — SPEC-V4.0.md sections 5 and 6.
//
// Rule for editing this file: a variant `id` is NEVER renamed or removed. Ids
// are snapshotted into SetLog.variantId at log time, so a removed id turns a
// historical set into an unlabelled one. `level` and array order carry no
// stored data (level only feeds analysis.ts's leverage-jump guardrail), so
// those may be rebuilt freely — which is what v4.0 does, reordering the
// existing chains to match the plan's own progressions while keeping every
// pre-v4 id resolvable.
import type { Ladder } from '../domain/types';

const ASSISTANCE_TIERS = ['none', 'light band', 'medium band', 'heavy band'];

export const ladders: Ladder[] = [
  // --- SPEC-V4.0.md section 5: strength progression chains ---
  {
    id: 'frontLever',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      // `tuck` predates v4.0's chain, which starts at advanced tuck. Kept at the
      // bottom so pre-v4 logs still resolve a label.
      { id: 'tuck', label: 'tuck', level: 0 },
      { id: 'advanced-tuck', label: 'advanced tuck', level: 1 },
      { id: 'open-advanced-tuck', label: 'open advanced tuck', level: 2 },
      { id: 'one-leg', label: 'one-leg', level: 3 },
      { id: 'alternating-one-leg', label: 'alternating one-leg', level: 4 },
      { id: 'assisted-straddle', label: 'assisted straddle', level: 5 },
      { id: 'straddle', label: 'straddle', level: 6 },
      { id: 'half-lay', label: 'half-lay', level: 7 },
      { id: 'lightly-assisted-full', label: 'lightly assisted full', level: 8 },
      { id: 'full', label: 'full front lever', level: 9 },
    ],
  },
  {
    id: 'hspu',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'floor-pike', label: 'floor pike push-up', level: 0 },
      { id: 'elevated-pike-low', label: 'elevated pike push-up', level: 1 },
      { id: 'elevated-pike-high', label: 'higher-feet pike push-up', level: 2 },
      { id: 'deficit-pike', label: 'deficit pike push-up', level: 3 },
      { id: 'deeper-deficit-pike', label: 'deeper deficit pike', level: 4 },
      { id: 'wall-hspu-partial', label: 'partial wall HSPU', level: 5 },
      { id: 'wall-hspu-full', label: 'full wall HSPU', level: 6 },
      { id: 'wall-hspu-deficit', label: 'deficit wall HSPU', level: 7 },
      { id: 'freestanding-hspu', label: 'freestanding HSPU', level: 8 },
    ],
  },
  {
    id: 'handstandBalance',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'chest-to-wall-line', label: 'chest-to-wall line', level: 0 },
      // The four ids below are the pre-v4 `handstandEntry` ladder, folded into
      // this one at the positions the v4.0 chain gives them.
      { id: 'wall-toe-pull', label: 'controlled toe pulls', level: 1 },
      { id: 'wall-heel-pull', label: 'heel pulls', level: 2 },
      { id: 'wall-release-short', label: 'repeated 2–5 s wall releases', level: 3 },
      { id: 'wall-release-long', label: '5–10 s wall releases', level: 4 },
      { id: 'wall-supported-kickup', label: 'wall-supported kick-up', level: 5 },
      { id: 'freestanding-kickup', label: 'controlled freestanding kick-up', level: 6 },
      { id: 'freestanding-hold', label: 'consistent 10–20 s handstand', level: 7 },
      { id: 'balance-through-lowering', label: 'balance through HSPU lowering', level: 8 },
      { id: 'freestanding-hspu-control', label: 'freestanding HSPU control', level: 9 },
    ],
  },
  {
    id: 'frontLeverRow',
    assistanceTiers: ASSISTANCE_TIERS,
    // Priority is shape before band reduction — the ladder is ordered by how
    // much assistance the full shape needs, not by how close it looks to a row.
    variants: [
      { id: 'heavy-band-full-shape', label: 'heavy-band full-shape row', level: 0 },
      { id: 'medium-band-full', label: 'medium-band full row', level: 1 },
      { id: 'light-band-full', label: 'light-band full row', level: 2 },
      { id: 'very-light-band-full', label: 'very-light-band full row', level: 3 },
      { id: 'bodyweight-fl-row', label: 'bodyweight front-lever row', level: 4 },
    ],
  },
  {
    id: 'dragonFlag',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'bent-knee-eccentric', label: 'bent-knee eccentric', level: 0 },
      { id: 'tuck-dragon-flag', label: 'tuck dragon flag', level: 1 },
      { id: 'single-leg-dragon-flag', label: 'single-leg dragon flag', level: 2 },
      { id: 'full-eccentric', label: 'full eccentric', level: 3 },
      { id: 'full-concentric', label: 'full concentric dragon flag', level: 4 },
      { id: 'slower-full', label: 'slower full dragon flag', level: 5 },
      { id: 'weighted-dragon-flag', label: 'weighted dragon flag', level: 6 },
    ],
  },
  {
    id: 'abWheel',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'kneeling-rollout', label: 'kneeling rollout', level: 0 },
      { id: 'standing-high-box', label: 'standing rollout to high box', level: 1 },
      { id: 'standing-low-box', label: 'standing rollout to lower box', level: 2 },
      { id: 'standing-very-low', label: 'standing rollout to very low target', level: 3 },
      { id: 'full-standing-rollout', label: 'full standing rollout', level: 4 },
      { id: 'full-rollout-pause', label: 'full rollout with pause', level: 5 },
    ],
  },
  {
    id: 'windshieldWiper',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'bent-knee-wiper', label: 'bent-knee wiper', level: 0 },
      { id: 'partially-extended', label: 'partially extended legs', level: 1 },
      { id: 'straight-reduced-rom', label: 'straight legs, reduced ROM', level: 2 },
      { id: 'straight-full-rom', label: 'straight legs, full ROM', level: 3 },
      { id: 'slower-eccentric-wiper', label: 'slower eccentric', level: 4 },
      { id: 'paused-wiper', label: 'pause at each side', level: 5 },
    ],
  },
  {
    id: 'nordic',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'band-assisted-eccentric', label: 'band-assisted eccentric', level: 0 },
      { id: 'band-assisted-full', label: 'band-assisted full rep', level: 1 },
      { id: 'less-assistance', label: 'less assistance', level: 2 },
      { id: 'bw-eccentric-partial-concentric', label: 'bodyweight eccentric + partial concentric', level: 3 },
      { id: 'full-nordic', label: 'full Nordic', level: 4 },
      { id: 'slow-full-nordic', label: 'slow full Nordic', level: 5 },
      { id: 'loaded-nordic', label: 'lightly loaded Nordic', level: 6 },
    ],
  },

  // --- SPEC-V4.0.md section 6: flexibility progression chains ---
  // Progressed on ROM -> control -> load, never on pain tolerance.
  {
    id: 'pancake',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'wide-seated-straddle', label: 'wide seated straddle', level: 0 },
      { id: 'upright-loaded-good-morning', label: 'upright loaded pancake good morning', level: 1 },
      { id: 'elbows-toward-floor', label: 'elbows toward floor', level: 2 },
      { id: 'forearms-to-floor', label: 'forearms to floor', level: 3 },
      { id: 'chest-approaching-floor', label: 'chest approaching floor', level: 4 },
      { id: 'chest-to-floor', label: 'chest-to-floor pancake', level: 5 },
      { id: 'loaded-chest-to-floor', label: 'lightly loaded chest-to-floor', level: 6 },
    ],
  },
  {
    id: 'middleSplit',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'wide-stance', label: 'wide stance', level: 0 },
      { id: 'deep-cossack', label: 'deep Cossack', level: 1 },
      { id: 'supported-middle-split', label: 'supported middle split', level: 2 },
      { id: 'lower-hand-support', label: 'lower hand support', level: 3 },
      { id: 'fingertip-support-middle', label: 'fingertip support', level: 4 },
      { id: 'pelvis-to-floor', label: 'pelvis to floor', level: 5 },
      { id: 'active-middle-split', label: 'active middle-split strength', level: 6 },
    ],
  },
  {
    id: 'frontSplit',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'long-lunge', label: 'long lunge', level: 0 },
      { id: 'half-split', label: 'half split', level: 1 },
      { id: 'high-supported-split', label: 'high supported split', level: 2 },
      { id: 'low-supported-split', label: 'low supported split', level: 3 },
      { id: 'fingertip-supported-split', label: 'fingertip-supported split', level: 4 },
      { id: 'square-full-front-split', label: 'square full front split', level: 5 },
    ],
  },
  {
    id: 'pike',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'hands-to-shins', label: 'hands to shins', level: 0 },
      { id: 'hands-to-feet', label: 'hands to feet', level: 1 },
      { id: 'fingertips-beyond-feet', label: 'fingertips beyond feet', level: 2 },
      { id: 'palms-beyond-feet', label: 'palms beyond feet', level: 3 },
      { id: 'chest-toward-thighs', label: 'chest toward thighs', level: 4 },
      { id: 'full-compressed-pike', label: 'full compressed pike', level: 5 },
    ],
  },
  {
    id: 'handstandShoulder',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'bench-shoulder-stretch', label: 'bench shoulder stretch', level: 0 },
      { id: 'wall-lift-off', label: 'wall lift-off', level: 1 },
      { id: 'clean-180-flexion', label: 'clean 180° flexion, no rib flare', level: 2 },
      { id: 'weighted-lift-off', label: 'weighted lift-off', level: 3 },
      { id: 'straight-ctw-line', label: 'straight chest-to-wall handstand line', level: 4 },
    ],
  },
  {
    id: 'bridge',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'elevated-bridge', label: 'elevated bridge', level: 0 },
      { id: 'floor-bridge', label: 'floor bridge', level: 1 },
      { id: 'straighter-elbows', label: 'straighter elbows', level: 2 },
      { id: 'shoulders-over-hands', label: 'shoulders farther over hands', level: 3 },
      { id: 'narrower-stance', label: 'narrower stance', level: 4 },
      { id: 'high-gymnastics-bridge', label: 'high gymnastics bridge', level: 5 },
    ],
  },

  // --- Retired chains ---
  // No v4.0 exercise references these. They stay so that pre-v4 logs — pistol
  // squats and the press-to-handstand, both dropped from the block — still
  // resolve their variant labels on the Progress screen.
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
    id: 'press',
    assistanceTiers: ASSISTANCE_TIERS,
    variants: [
      { id: 'band-assisted-bent-arm', label: 'band-assisted bent-arm', level: 0 },
      { id: 'unassisted-bent-arm', label: 'unassisted bent-arm', level: 1 },
      { id: 'band-assisted-straight-arm', label: 'band-assisted straight-arm', level: 2 },
      { id: 'unassisted-straight-arm', label: 'unassisted straight-arm', level: 3 },
    ],
  },
  {
    id: 'handstandEntry',
    assistanceTiers: ASSISTANCE_TIERS,
    // Superseded by `handstandBalance`, which carries these same four ids.
    // Retained only so a retired exercise's `ladderId` still resolves.
    variants: [
      { id: 'wall-toe-pull', label: 'wall toe pull', level: 0 },
      { id: 'wall-heel-pull', label: 'wall heel pull', level: 1 },
      { id: 'wall-supported-kickup', label: 'wall-supported kick-up', level: 2 },
      { id: 'freestanding-kickup', label: 'freestanding kick-up', level: 3 },
    ],
  },
];
