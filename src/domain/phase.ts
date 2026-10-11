// Week/phase resolution — SPEC.md section 6.1.
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import type { Block, DayId, Exercise, Phase, Prescription } from './types';

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

// ---------------------------------------------------------------------------
// Block-day addressing — SPEC-V3.0.md section 4.
//
// The block is 84 consecutive days indexed 0..83 from settings.blockStartDate.
// The Today screen shows exactly one of them, and every one of them is
// reachable in both directions and editable. These helpers exist so the bounds
// live in one place: before v3.0 the clamp was duplicated between the pager's
// handlers and its disabled props, which is how they came to disagree.
// ---------------------------------------------------------------------------

export const BLOCK_DAYS = 84; // 12 weeks

/** 0-based day index within the block. Negative before it, >83 after it. */
export function blockDayIndex(date: Date, blockStartDate: string): number {
  return differenceInCalendarDays(date, parseISO(blockStartDate));
}

/** The date at a given block-day index. Does not clamp — callers clamp first. */
export function dateForBlockDay(blockStartDate: string, index: number): Date {
  return addDays(parseISO(blockStartDate), index);
}

/** Clamps a block-day index into 0..83. */
export function clampBlockDay(index: number): number {
  return Math.min(BLOCK_DAYS - 1, Math.max(0, index));
}

/** True if this index addresses a real day of the block. */
export function isWithinBlock(index: number): boolean {
  return index >= 0 && index < BLOCK_DAYS;
}

// ---------------------------------------------------------------------------
// Block structure — SPEC-V6.0.md section 3.
//
// Build 1, Build 2, a single deload at week 5, Build 3, Peak + test, and a
// floor-only Christmas fortnight. Both tables are indexed by week rather than
// derived, because the phases are not equal in length.
// ---------------------------------------------------------------------------

const PHASE_BY_WEEK: Phase[] = [
  'build1', // 1
  'build1', // 2
  'build2', // 3
  'build2', // 4
  'deload', // 5
  'build3', // 6
  'build3', // 7
  'build3', // 8
  'peak', // 9
  'peak', // 10
  'christmas', // 11
  'christmas', // 12
];

export function phaseForWeek(week: number): Phase {
  return PHASE_BY_WEEK[Math.min(12, Math.max(1, week)) - 1];
}

// The highest RPE the plan itself prescribes on the STRENGTH scale in each
// week, read off the "Sets by phase" table. Used as the stop-rule ceiling, so a
// set logged above it means the session drifted off plan. The Christmas
// fortnight prescribes no RPE at all ("—"), so it has no ceiling: null.
const RPE_CAP_BY_WEEK: (number | null)[] = [8.5, 8.5, 8.5, 8.5, 7, 9, 9, 9, 10, 10, null, null];

export function weekRpeCap(week: number): number | null {
  return RPE_CAP_BY_WEEK[Math.min(12, Math.max(1, week)) - 1];
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

/**
 * Exercises for a given day and block, in display order, restricted to those
 * actually prescribed in the given week.
 *
 * "Prescribed" means a prescription resolves AND it asks for at least one set.
 * `sets: 0` is a deliberate opt-out (SPEC-V4.0.md section 4). v6.0 uses it
 * for the Christmas fortnight: weeks 11–12 run the floor session only, so every
 * exercise outside the floor is authored as zero there. Authoring those weeks
 * explicitly is what stops the nearest-earlier fallback above from carrying
 * week 10's numbers into them.
 *
 * Shared by Today and SessionRunner, which need the same day -> session pipeline.
 */
export function exercisesFor(program: Exercise[], dayId: DayId, block: Block, week: number): Exercise[] {
  return program
    .filter((e) => e.day === dayId && e.block === block)
    .filter((e) => (resolvePrescription(e, week)?.sets ?? 0) > 0)
    .sort((a, b) => a.order - b.order);
}
