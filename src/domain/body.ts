// Rolling weight average, weekly rate, cut-corridor status — SPEC.md section 6.9.
import { addDays, format, parseISO, subDays } from 'date-fns';
import { currentWeek } from './phase';
import type { DailyEntry, SessionLog } from './types';

export const TUNING = {
  MIN_ROLLING_POINTS: 4,
  // weeklyRateKg above this is losing weight too slowly; below the other is too fast.
  CORRIDOR_TOO_SLOW_KG: -0.3,
  CORRIDOR_TOO_FAST_KG: -0.6,
};

function rollingMean(
  entries: DailyEntry[],
  field: 'weightKg' | 'calories' | 'proteinG' | 'carbsG' | 'fatG',
  asOfDate: string,
): number | null {
  const values = entries
    .filter((e) => e.date <= asOfDate && e[field] !== undefined)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7)
    .map((e) => e[field] as number);
  if (values.length < TUNING.MIN_ROLLING_POINTS) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function rolling7Weight(entries: DailyEntry[], asOfDate: string): number | null {
  return rollingMean(entries, 'weightKg', asOfDate);
}

export function rolling7Calories(entries: DailyEntry[], asOfDate: string): number | null {
  return rollingMean(entries, 'calories', asOfDate);
}

export function rolling7Protein(entries: DailyEntry[], asOfDate: string): number | null {
  return rollingMean(entries, 'proteinG', asOfDate);
}

export function rolling7Carbs(entries: DailyEntry[], asOfDate: string): number | null {
  return rollingMean(entries, 'carbsG', asOfDate);
}

export function rolling7Fat(entries: DailyEntry[], asOfDate: string): number | null {
  return rollingMean(entries, 'fatG', asOfDate);
}

/** 4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat — SPEC-V1.1.md section 3. */
export function caloriesFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return proteinG * 4 + carbsG * 4 + fatG * 9;
}

export function weeklyRateKg(entries: DailyEntry[], asOfDate: string): number | null {
  const current = rolling7Weight(entries, asOfDate);
  if (current === null) return null;
  const priorDate = format(subDays(parseISO(asOfDate), 7), 'yyyy-MM-dd');
  const prior = rolling7Weight(entries, priorDate);
  if (prior === null) return null;
  return current - prior;
}

export function weeklyRatePct(entries: DailyEntry[], asOfDate: string): number | null {
  const rate = weeklyRateKg(entries, asOfDate);
  const current = rolling7Weight(entries, asOfDate);
  if (rate === null || current === null || current === 0) return null;
  return (rate / current) * 100;
}

export type CorridorStatus = 'onTrack' | 'tooSlow' | 'tooFast';

export function corridorStatus(rateKg: number | null): CorridorStatus | null {
  if (rateKg === null) return null;
  if (rateKg > TUNING.CORRIDOR_TOO_SLOW_KG) return 'tooSlow';
  if (rateKg < TUNING.CORRIDOR_TOO_FAST_KG) return 'tooFast';
  return 'onTrack';
}

/** Projected week-12 weight from the current rolling average and rate. */
export function projectedWeekTwelveWeight(
  entries: DailyEntry[],
  asOfDate: string,
  blockStartDate: string,
): number | null {
  const current = rolling7Weight(entries, asOfDate);
  const rate = weeklyRateKg(entries, asOfDate);
  if (current === null || rate === null) return null;
  const week = currentWeek(parseISO(asOfDate), blockStartDate);
  return current + rate * (12 - week);
}

export function totalChangeFromStart(
  entries: DailyEntry[],
  asOfDate: string,
  startWeightKg: number,
): number | null {
  const current = rolling7Weight(entries, asOfDate);
  if (current === null) return null;
  return current - startWeightKg;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface WeeklySummary {
  week: number;
  meanWeightKg: number | null;
  changeKg: number | null;
  ratePct: number | null;
  meanCalories: number | null;
  meanProteinG: number | null;
  meanCarbsG: number | null;
  meanFatG: number | null;
  sessionsCompleted: number;
}

/** Per-calendar-week means (not rolling), for the Body screen's weekly table (SPEC.md section 7.4). */
export function weeklySummaries(
  entries: DailyEntry[],
  sessionLogs: Record<string, SessionLog>,
  blockStartDate: string,
  throughWeek: number,
): WeeklySummary[] {
  const start = parseISO(blockStartDate);
  const summaries: WeeklySummary[] = [];
  let prevMeanWeightKg: number | null = null;

  for (let week = 1; week <= throughWeek; week++) {
    const weekStart = format(addDays(start, (week - 1) * 7), 'yyyy-MM-dd');
    const weekEnd = format(addDays(start, week * 7 - 1), 'yyyy-MM-dd');
    const weekEntries = entries.filter((e) => e.date >= weekStart && e.date <= weekEnd);

    const meanWeightKg = mean(weekEntries.map((e) => e.weightKg).filter((v): v is number => v !== undefined));
    const meanCalories = mean(weekEntries.map((e) => e.calories).filter((v): v is number => v !== undefined));
    const meanProteinG = mean(weekEntries.map((e) => e.proteinG).filter((v): v is number => v !== undefined));
    const meanCarbsG = mean(weekEntries.map((e) => e.carbsG).filter((v): v is number => v !== undefined));
    const meanFatG = mean(weekEntries.map((e) => e.fatG).filter((v): v is number => v !== undefined));

    const changeKg =
      meanWeightKg !== null && prevMeanWeightKg !== null ? meanWeightKg - prevMeanWeightKg : null;
    const ratePct =
      changeKg !== null && prevMeanWeightKg !== null && prevMeanWeightKg !== 0
        ? (changeKg / prevMeanWeightKg) * 100
        : null;

    summaries.push({
      week,
      meanWeightKg,
      changeKg,
      ratePct,
      meanCalories,
      meanProteinG,
      meanCarbsG,
      meanFatG,
      sessionsCompleted: Object.values(sessionLogs).filter((s) => s.week === week && s.completedAt).length,
    });

    if (meanWeightKg !== null) prevMeanWeightKg = meanWeightKg;
  }

  return summaries;
}
