// Difficulty Index — SPEC.md section 6.2.
import type { Exercise, Ladder, SetLog } from './types';

export const TUNING = {
  assistancePenalty: 0.6,
  extendedRomBonus: 0.5,
  partialRomPenalty: -0.5,
};

/**
 * effectiveLevel(variantLevel, assistanceTier, romBonus) =
 *   variantLevel − 0.6 × assistanceTier + romBonus, clamped to >= 0.
 */
export function effectiveLevel(variantLevel: number, assistanceTier: number, romBonus = 0): number {
  const raw = variantLevel - TUNING.assistancePenalty * assistanceTier + romBonus;
  return Math.max(0, raw);
}

/**
 * romBonus per SPEC.md 6.2: +0.5 for extended ROM, −0.5 for partial ROM, else 0.
 * The data model (SPEC.md section 4) only records ROM regression via the
 * `partialROM` technique flag — there is no "extended ROM" input on SetLog,
 * so that half of the bonus can never fire until the data model grows one.
 */
export function romBonusFor(set: Pick<SetLog, 'techniqueFlags'>): number {
  return set.techniqueFlags.includes('partialROM') ? TUNING.partialRomPenalty : 0;
}

/** Effective level for a logged set, using its snapshot variant + assistance tier. */
export function effectiveLevelForSet(_exercise: Exercise, ladder: Ladder | undefined, set: SetLog): number {
  const variant = ladder && set.variantId ? ladder.variants.find((v) => v.id === set.variantId) : undefined;
  const variantLevel = variant?.level ?? 0;
  return effectiveLevel(variantLevel, set.assistanceTier ?? 0, romBonusFor(set));
}
