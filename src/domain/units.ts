// Weight unit conversion — SPEC-V1.1.md section 3. Display and entry only:
// the domain and every stored/exported value stay kg-native regardless of
// this setting. Never import this into scoring.ts, body.ts, or anything
// that reads or writes persisted state.
import { fmt, fmtSigned } from './format';

export type WeightUnit = 'kg' | 'lbs';

const KG_PER_LB = 0.45359237;

export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

/** Converts a stored kg quantity (an absolute weight or a delta) to the display unit. No rounding. */
export function convertWeight(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? kgToLbs(kg) : kg;
}

/** Converts a value entered in the display unit back to kg for storage. Never rounds. */
export function parseWeight(input: number, unit: WeightUnit): number {
  return unit === 'lbs' ? lbsToKg(input) : input;
}

/**
 * Formats a stored kg value for display, e.g. "74.8 kg" or "165.0 lbs".
 * Rounding goes through format.ts, so this can never exceed 2 dp
 * (SPEC-V3.0.md section 7).
 */
export function formatWeight(kg: number, unit: WeightUnit, decimals = 1): string {
  return `${fmt(convertWeight(kg, unit), decimals)} ${unit}`;
}

/** Bare converted+rounded weight with no unit suffix, for tight table cells. */
export function fmtKg(kg: number, unit: WeightUnit, decimals = 1): string {
  return fmt(convertWeight(kg, unit), decimals);
}

/** A signed weight delta in the display unit, e.g. "−0.42" — no unit suffix. */
export function fmtKgSigned(kg: number, unit: WeightUnit, decimals = 2): string {
  return fmtSigned(convertWeight(kg, unit), decimals);
}
