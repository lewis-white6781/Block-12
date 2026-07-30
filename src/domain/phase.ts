// Week/phase resolution — SPEC.md section 6.1.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { DayId, Exercise, Phase, Prescription } from './types';

const DAY_IDS: DayId[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function dayIdForDate(date: Date): DayId {
  return DAY_IDS[date.getDay()];
}

function rawWeek(today: Date, blockStartDate: string): number {
  const days = differenceInCalendarDays(today, parseISO(blockStartDate));
  return Math.floor(days / 7) + 1;
}

/** Current week of the block, clamped to 1..12. Never crashes on out-of-range dates. */
export function currentWeek(today: Date, blockStartDate: string): number {
  return Math.min(12, Math.max(1, rawWeek(today, blockStartDate)));
}

/** True once the block has run past week 12 — the UI should show "Block complete". */
export function isBlockComplete(today: Date, blockStartDate: string): boolean {
  return rawWeek(today, blockStartDate) > 12;
}

export function phaseForWeek(week: number): Phase {
  if (week <= 2) return 'calibration';
  if (week <= 5) return 'accumulation';
  if (week === 6) return 'deload';
  if (week <= 9) return 'intensification';
  if (week === 10) return 'peak';
  if (week === 11) return 'taper';
  return 'test';
}

/**
 * Exact match on prescription.weeks, else the prescription whose latest listed
 * week is nearest-earlier to the target week, else null.
 */
export function resolvePrescription(exercise: Exercise, week: number): Prescription | null {
  const exact = exercise.prescriptions.find((p) => p.weeks.includes(week));
  if (exact) return exact;

  let best: Prescription | null = null;
  let bestWeek = -Infinity;
  for (const prescription of exercise.prescriptions) {
    const latestWeek = Math.max(...prescription.weeks);
    if (latestWeek < week && latestWeek > bestWeek) {
      best = prescription;
      bestWeek = latestWeek;
    }
  }
  return best;
}
