// Daily nutrition targets and the weekly calorie check — SPEC-V6.0.md section 6.
//
// Two questions, kept apart:
//
//   1. What should today's targets be? The table row for the 7-day average
//      weight, plus every calorie adjustment applied so far (all from carbs).
//   2. Should the target change? Only from week 3, only once the weight trend
//      is measurable, and only when the calories actually eaten were on target.
//      A rate that is off while intake is ALSO off is an intake problem, not a
//      target problem, and the check says so instead of moving the target.
import { format, parseISO, subDays } from 'date-fns';
import { NUTRITION_RULES, nutritionTable } from '../data/nutrition';
import type { NutritionRow } from '../data/nutrition';
import { weeklyRateKg } from './body';
import { fmt } from './format';
import { currentWeek } from './phase';
import type { DailyEntry, NutritionAdjustment, Settings } from './types';

export const NUTRITION_TUNING = {
  /**
   * How far the average intake may sit from the average target and still
   * count as "eating to target". Rule 5 says "stay roughly on calories"; the
   * plan gives no number, so this is the app's reading of "roughly".
   */
  ADHERENCE_TOLERANCE_KCAL: 100,
  /** Logged-calorie days needed in the 7-day intake window before judging adherence. */
  MIN_INTAKE_DAYS: 5,
  /** Days after an adjustment before the next one is judged — the rate needs a week to respond. */
  SETTLE_DAYS: 7,
};

function isoDaysBefore(date: string, days: number): string {
  return format(subDays(parseISO(date), days), 'yyyy-MM-dd');
}

/**
 * The table row for a weight. Rows are inclusive at their lower bound, so
 * 78.0 is the 78.0–78.9 row. Below 73.0 the plan has no row: the bottom row is
 * returned and flagged rather than inventing a new one.
 */
export function rowForWeight(kg: number): { row: NutritionRow; belowTable: boolean } {
  const row = nutritionTable.find((r) => kg >= r.minKg);
  if (row) return { row, belowTable: false };
  return { row: nutritionTable[nutritionTable.length - 1], belowTable: true };
}

/** Mean of the weigh-ins dated in the 7 days ending on `asOfDate`, inclusive. */
export function sevenDayAverageWeight(
  entries: DailyEntry[],
  asOfDate: string,
): { kg: number; count: number } | null {
  const from = isoDaysBefore(asOfDate, 6);
  const weights = entries
    .filter((e) => e.date >= from && e.date <= asOfDate && e.weightKg !== undefined)
    .map((e) => e.weightKg as number);
  if (weights.length === 0) return null;
  return { kg: weights.reduce((sum, w) => sum + w, 0) / weights.length, count: weights.length };
}

function latestWeightOnOrBefore(entries: DailyEntry[], asOfDate: string): number | null {
  let latest: DailyEntry | null = null;
  for (const e of entries) {
    if (e.weightKg === undefined || e.date > asOfDate) continue;
    if (!latest || e.date > latest.date) latest = e;
  }
  return latest?.weightKg ?? null;
}

/** Net calorie change from every adjustment in effect on `date`. */
export function adjustmentKcalAsOf(adjustments: NutritionAdjustment[] | undefined, date: string): number {
  return (adjustments ?? []).filter((a) => a.date <= date).reduce((sum, a) => sum + a.kcal, 0);
}

export type WeightBasis = 'avg7' | 'latest' | 'start';

export interface DailyTargets {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  row: NutritionRow;
  belowTable: boolean;
  /** Which weight chose the row: the 7-day average, the last weigh-in, or the start weight. */
  basis: WeightBasis;
  basisKg: number;
  /** Weigh-ins behind a 7-day average basis. 0 otherwise. */
  basisCount: number;
  adjustmentKcal: number;
}

/**
 * Targets for one day. Rule 1 picks the row by the 7-day average. Before any
 * weigh-in exists in that window the most recent weigh-in stands in, and
 * before any weigh-in at all, the start weight — so the first morning of the
 * block still has a target.
 */
export function dailyTargets(entries: DailyEntry[], settings: Settings, date: string): DailyTargets {
  const avg = sevenDayAverageWeight(entries, date);
  const latest = avg ? null : latestWeightOnOrBefore(entries, date);
  const basis: WeightBasis = avg ? 'avg7' : latest !== null ? 'latest' : 'start';
  const basisKg = avg?.kg ?? latest ?? settings.startWeightKg;

  const { row, belowTable } = rowForWeight(basisKg);
  const adjustmentKcal = adjustmentKcalAsOf(settings.nutritionAdjustments, date);

  return {
    kcal: row.kcal + adjustmentKcal,
    proteinG: row.proteinG,
    fatG: row.fatG,
    // Rules 3 and 4 move calories through carbs only, at 4 kcal/g.
    carbsG: Math.round(row.carbsG + adjustmentKcal / 4),
    row,
    belowTable,
    basis,
    basisKg,
    basisCount: avg?.count ?? 0,
    adjustmentKcal,
  };
}

export type NutritionCheckStatus =
  | 'early' // weeks 1–2: the plan only adjusts from week 3
  | 'settling' // an adjustment was applied in the last week
  | 'needData' // not enough weigh-ins or calorie logs to judge
  | 'onTrack'
  | 'tooSlow' // rule 3 — eating to target, losing under 0.25 kg/wk
  | 'tooFast' // rule 4 — eating to target, losing over 0.75 kg/wk
  | 'overTarget' // losing too slowly, but eating above target
  | 'underTarget'; // losing too fast, but eating below target

export interface NutritionCheck {
  status: NutritionCheckStatus;
  week: number;
  /** 7-day-average weight change per week. Negative is a loss. */
  rateKgPerWeek: number | null;
  /** Mean logged calories over the 7 days BEFORE asOfDate — today is not finished. */
  meanIntakeKcal: number | null;
  /** Mean target over the same logged days. */
  meanTargetKcal: number | null;
  intakeDays: number;
  /** The signed change to apply, when the check recommends one. */
  recommendedKcal: number | null;
  message: string;
}

// Messages state the plan's rules in the plan's unit (kg/week), whatever the
// display unit — the thresholds themselves are kg.
function kg(value: number): string {
  return fmt(value, 2);
}

export function nutritionCheck(entries: DailyEntry[], settings: Settings, asOfDate: string): NutritionCheck {
  const week = currentWeek(parseISO(asOfDate), settings.blockStartDate);
  const rate = weeklyRateKg(entries, asOfDate);

  // Intake window: the 7 complete days before today.
  const from = isoDaysBefore(asOfDate, 7);
  const intakeEntries = entries.filter(
    (e) => e.date >= from && e.date < asOfDate && e.calories !== undefined,
  );
  const intakeDays = intakeEntries.length;
  const meanIntakeKcal =
    intakeDays > 0 ? intakeEntries.reduce((sum, e) => sum + (e.calories as number), 0) / intakeDays : null;
  const meanTargetKcal =
    intakeDays > 0
      ? intakeEntries.reduce((sum, e) => sum + dailyTargets(entries, settings, e.date).kcal, 0) / intakeDays
      : null;

  const base = { week, rateKgPerWeek: rate, meanIntakeKcal, meanTargetKcal, intakeDays, recommendedKcal: null };
  const rateText = rate !== null ? `${rate <= 0 ? 'Losing' : 'Gaining'} ${kg(Math.abs(rate))} kg/week. ` : '';

  if (week < NUTRITION_RULES.adjustFromWeek) {
    return {
      ...base,
      status: 'early',
      message: `${rateText}Calorie adjustments start in week ${NUTRITION_RULES.adjustFromWeek} — hold the table until then.`,
    };
  }

  const adjustments = settings.nutritionAdjustments ?? [];
  const lastAdjustment = adjustments.reduce<NutritionAdjustment | null>(
    (latest, a) => (a.date <= asOfDate && (!latest || a.date > latest.date) ? a : latest),
    null,
  );
  if (lastAdjustment && lastAdjustment.date > isoDaysBefore(asOfDate, NUTRITION_TUNING.SETTLE_DAYS)) {
    const sign = lastAdjustment.kcal > 0 ? '+' : '−';
    return {
      ...base,
      status: 'settling',
      message: `${rateText}You changed calories by ${sign}${Math.abs(lastAdjustment.kcal)} kcal on ${lastAdjustment.date}. Give it a week before judging again.`,
    };
  }

  if (rate === null) {
    return {
      ...base,
      status: 'needData',
      message: 'Weigh in at least 4 mornings in each of the last two weeks to measure the rate of loss.',
    };
  }
  if (intakeDays < NUTRITION_TUNING.MIN_INTAKE_DAYS || meanIntakeKcal === null || meanTargetKcal === null) {
    return {
      ...base,
      status: 'needData',
      message: `${rateText}Log calories on at least ${NUTRITION_TUNING.MIN_INTAKE_DAYS} of the last 7 days so the check can tell a target problem from an intake one.`,
    };
  }

  const loss = -rate;
  const tolerance = NUTRITION_TUNING.ADHERENCE_TOLERANCE_KCAL;
  const intakeText = `You averaged ${fmt(meanIntakeKcal, 0)} kcal against a ${fmt(meanTargetKcal, 0)} kcal target.`;
  const step = NUTRITION_RULES.stepKcal;
  const grams = Math.round(step / 4);

  if (loss < NUTRITION_RULES.tooSlowLossKgPerWeek) {
    if (meanIntakeKcal > meanTargetKcal + tolerance) {
      return {
        ...base,
        status: 'overTarget',
        message: `${rateText}${intakeText} Hit the target for a week before cutting further.`,
      };
    }
    return {
      ...base,
      status: 'tooSlow',
      recommendedKcal: -step,
      message: `${rateText}Under ${NUTRITION_RULES.tooSlowLossKgPerWeek} kg/week while eating to target. Rule 3: remove ${step} kcal from carbs (−${grams} g).`,
    };
  }

  if (loss > NUTRITION_RULES.tooFastLossKgPerWeek) {
    if (meanIntakeKcal < meanTargetKcal - tolerance) {
      return {
        ...base,
        status: 'underTarget',
        message: `${rateText}${intakeText} Eat up to the target before adding calories.`,
      };
    }
    return {
      ...base,
      status: 'tooFast',
      recommendedKcal: step,
      message: `${rateText}Over ${NUTRITION_RULES.tooFastLossKgPerWeek} kg/week. Rule 4: if your lifts are dropping too, add ${step} kcal to carbs (+${grams} g).`,
    };
  }

  return {
    ...base,
    status: 'onTrack',
    message: `${rateText}Inside ${NUTRITION_RULES.tooSlowLossKgPerWeek}–${NUTRITION_RULES.tooFastLossKgPerWeek} kg/week. Keep the current targets.`,
  };
}
