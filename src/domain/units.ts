// Weight unit conversion — SPEC-V1.1.md section 3. Display and entry only:
// the domain and every stored/exported value stay kg-native regardless of
// this setting. Never import this into scoring.ts, body.ts, or anything
// that reads or writes persisted state.
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

/** Formats a stored kg value for display, e.g. "74.8 kg" or "165.0 lbs". */
export function formatWeight(kg: number, unit: WeightUnit, decimals = 1): string {
  return `${convertWeight(kg, unit).toFixed(decimals)} ${unit}`;
}
