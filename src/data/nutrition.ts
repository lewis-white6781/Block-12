// Nutrition guide — SPEC-V6.0.md section 6. Transcribed exactly from the
// "Nutrition" section of cut-to-new-year-training-nutrition.md.
//
// Same targets every day; the row is chosen by the 7-day average bodyweight.
// The table is the plan's — never edit a row to apply an adjustment. Rules 3
// and 4 are applied as dated Settings.nutritionAdjustments on top of it.

export interface NutritionRow {
  /** Lower bound of the row's weight band, inclusive. Rows run high to low. */
  minKg: number;
  label: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export const nutritionTable: NutritionRow[] = [
  { minKg: 79, label: '79.0 kg +', kcal: 2100, proteinG: 175, fatG: 65, carbsG: 205 },
  { minKg: 78, label: '78.0–78.9 kg', kcal: 2075, proteinG: 173, fatG: 65, carbsG: 200 },
  { minKg: 77, label: '77.0–77.9 kg', kcal: 2050, proteinG: 171, fatG: 65, carbsG: 195 },
  { minKg: 76, label: '76.0–76.9 kg', kcal: 2025, proteinG: 168, fatG: 65, carbsG: 192 },
  { minKg: 75, label: '75.0–75.9 kg', kcal: 2000, proteinG: 166, fatG: 65, carbsG: 187 },
  { minKg: 74, label: '74.0–74.9 kg', kcal: 1975, proteinG: 164, fatG: 65, carbsG: 184 },
  { minKg: 73, label: '73.0–73.9 kg', kcal: 1950, proteinG: 162, fatG: 65, carbsG: 178 },
];

/**
 * The numbers in rules 3 and 4. `stepKcal` moves through carbs only, so one
 * step is stepKcal / 4 grams of carbohydrate.
 */
export const NUTRITION_RULES = {
  adjustFromWeek: 3, // "From Week 3"
  tooSlowLossKgPerWeek: 0.25, // "losing under 0.25 kg/week"
  tooFastLossKgPerWeek: 0.75, // "losing over 0.75 kg/week"
  stepKcal: 150, // "remove / add 150 kcal"
};

/** The plan's five rules, verbatim, for display. */
export const nutritionRules: string[] = [
  'Weigh every morning after the toilet, before eating. Use the 7-day average to choose your row.',
  'Protein = 1 g per lb of bodyweight. Hit it first every day.',
  'From Week 3: losing under 0.25 kg/week → remove 150 kcal from carbs.',
  'From Week 3: losing over 0.75 kg/week and lifts dropping → add 150 kcal to carbs.',
  'Bad day: hit protein, stay roughly on calories.',
];
