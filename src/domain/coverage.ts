// Data completeness & provenance — v5.1 analytics (Block12 academic brief §E).
//
// The honest denominator problem: a missing record is NOT proof a workout was
// missed, and a chart built only from logged rows silently survives on the
// days that were logged. This module states, per week, what was prescribed,
// what was logged, and what is simply unknown — with the unknowns visible.
//
// Statuses are deliberately conservative:
//   notPrescribed — the program prescribes nothing for that day/slot
//   completed     — session completed (AM: every checklist item ticked)
//   logged        — a session exists with at least one logged set, not completed
//   unknown       — the date has passed and no log exists. NOT "missed".
//   upcoming      — the date is still ahead
// The app records no explicit "skipped" at session level, so no such status is
// invented here.
import { addDays, format, parseISO } from 'date-fns';
import { dayIdForDate, exercisesFor } from './phase';
import type { Block, DailyEntry, DayId, Exercise, SessionLog } from './types';

const BLOCKS: Block[] = ['am', 'main', 'later'];

export type SlotStatus = 'completed' | 'logged' | 'unknown' | 'upcoming';

export interface SlotCoverage {
  date: string;
  day: DayId;
  block: Block;
  status: SlotStatus;
}

export interface WeekCoverage {
  week: number;
  /** Prescribed session slots this week, with their observed status. */
  slots: SlotCoverage[];
  planned: number;
  completed: number;
  loggedOnly: number;
  unknown: number;
  upcoming: number;
  /** Days (of 7) with a morning weight recorded. */
  weightDays: number;
  /** Days (of 7) with calories recorded. */
  nutritionDays: number;
  /** Daily entries whose first write happened on a later day than their date. */
  retrospectiveEntries: number;
}

function slotStatus(
  session: SessionLog | undefined,
  amExercises: Exercise[],
  block: Block,
  date: string,
  todayISO: string,
): SlotStatus {
  if (session) {
    if (block === 'am') {
      // AM sessions never get completedAt — they're a checklist. Complete when
      // every prescribed item has a tick (same rule Review uses).
      const allTicked =
        amExercises.length > 0 &&
        amExercises.every((e) => session.exercises.some((log) => log.exerciseId === e.id && log.sets.length > 0));
      if (allTicked) return 'completed';
    }
    if (session.completedAt) return 'completed';
    if (session.exercises.some((e) => e.sets.length > 0)) return 'logged';
  }
  return date > todayISO ? 'upcoming' : 'unknown';
}

export function buildWeekCoverage(input: {
  week: number;
  blockStartDate: string;
  todayISO: string;
  program: Exercise[];
  sessionLogs: Record<string, SessionLog>;
  dailyEntries: Record<string, DailyEntry>;
}): WeekCoverage {
  const { week, blockStartDate, todayISO, program, sessionLogs, dailyEntries } = input;
  const weekStart = parseISO(blockStartDate);
  const slots: SlotCoverage[] = [];
  let weightDays = 0;
  let nutritionDays = 0;
  let retrospectiveEntries = 0;

  for (let i = 0; i < 7; i++) {
    const date = format(addDays(weekStart, (week - 1) * 7 + i), 'yyyy-MM-dd');
    const day = dayIdForDate(parseISO(date));
    const amExercises = exercisesFor(program, day, 'am', week);

    for (const block of BLOCKS) {
      if (exercisesFor(program, day, block, week).length === 0) continue; // not prescribed
      const session = sessionLogs[`${date}:${block}`];
      slots.push({ date, day, block, status: slotStatus(session, amExercises, block, date, todayISO) });
    }

    const entry = dailyEntries[date];
    if (entry?.weightKg !== undefined) weightDays++;
    if (entry?.calories !== undefined) nutritionDays++;
    if (entry && entry.updatedAt.slice(0, 10) > entry.date) retrospectiveEntries++;
  }

  const count = (status: SlotStatus) => slots.filter((s) => s.status === status).length;
  return {
    week,
    slots,
    planned: slots.length,
    completed: count('completed'),
    loggedOnly: count('logged'),
    unknown: count('unknown'),
    upcoming: count('upcoming'),
    weightDays,
    nutritionDays,
    retrospectiveEntries,
  };
}
