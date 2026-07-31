// Single source of truth for "what day is it" — SPEC-V1.1.md prompt 1.
// Everywhere the app needs to know the current date, it should go through
// here instead of calling `new Date()` directly, so there is exactly one
// place to change when Prompt 3 adds day navigation.
import { format, startOfDay } from 'date-fns';

/** Today's calendar date, normalised to local midnight. */
export function startOfToday(): Date {
  return startOfDay(new Date());
}

/** Today's date as an ISO yyyy-MM-dd string. */
export function todayISO(): string {
  return format(startOfToday(), 'yyyy-MM-dd');
}
