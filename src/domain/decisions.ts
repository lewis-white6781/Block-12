// Decision journal maths — v5.1 analytics (Block12 academic brief §C/§D).
//
// Pure functions over DecisionEntry records. A follow-up becomes DUE when the
// entry's observation window has been observed: for an exercise-linked
// decision that is N subsequent sessions that actually logged qualifying work
// on that exercise ("comparable sessions"); for a general decision it is N
// days. Nothing here computes an improvement score — the follow-up OUTCOME is
// recorded by the athlete against the named observation, and "not comparable"
// and "insufficient data" are first-class results, not failures.
import { addDays, format, parseISO } from 'date-fns';
import { isQualifyingSet } from './scoring';
import type { DecisionEntry, SessionLog } from './types';

/**
 * Sessions strictly after the decision date with at least one qualifying set
 * of the decision's exercise. This is the denominator for "reviewed over the
 * next N comparable sessions". Variant changes are NOT filtered out here —
 * whether a harder variant is comparable is a judgement the follow-up records
 * explicitly (outcome 'notComparable'), never a silent exclusion.
 */
export function comparableSessionsSince(
  sessionLogs: Record<string, SessionLog>,
  exerciseId: string,
  afterDate: string,
): SessionLog[] {
  return Object.values(sessionLogs)
    .filter(
      (s) =>
        s.date > afterDate &&
        s.exercises.some((e) => e.exerciseId === exerciseId && e.sets.some(isQualifyingSet)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type FollowUpStatus =
  | { kind: 'recorded' }
  | { kind: 'due'; comparableSessions: number }
  | { kind: 'waiting'; comparableSessions: number; needed: number };

export function followUpStatus(
  entry: DecisionEntry,
  sessionLogs: Record<string, SessionLog>,
  todayISO: string,
): FollowUpStatus {
  if (entry.followUp) return { kind: 'recorded' };

  if (entry.exerciseId) {
    const observed = comparableSessionsSince(sessionLogs, entry.exerciseId, entry.eventDate).length;
    if (observed >= entry.followUpSessions) return { kind: 'due', comparableSessions: observed };
    return { kind: 'waiting', comparableSessions: observed, needed: entry.followUpSessions };
  }

  // No linked exercise: the window is followUpSessions DAYS.
  const dueDate = format(addDays(parseISO(entry.eventDate), entry.followUpSessions), 'yyyy-MM-dd');
  if (todayISO >= dueDate) return { kind: 'due', comparableSessions: 0 };
  return { kind: 'waiting', comparableSessions: 0, needed: entry.followUpSessions };
}

/** Entries whose follow-up window has been observed but not yet recorded, oldest first. */
export function dueFollowUps(
  decisionEntries: Record<string, DecisionEntry>,
  sessionLogs: Record<string, SessionLog>,
  todayISO: string,
): DecisionEntry[] {
  return Object.values(decisionEntries)
    .filter((e) => followUpStatus(e, sessionLogs, todayISO).kind === 'due')
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

export interface WeekDecisionCounts {
  total: number;
  accepted: number;
  overriddenOrRejected: number;
  manual: number;
  followUpsRecorded: number;
  insufficientOrNotComparable: number;
}

/**
 * Counts for one calendar week of the block. "Followed" and "followed by an
 * improved observation" are reported as separate facts — neither is proof of
 * effectiveness, and nothing here aggregates them into one.
 */
export function weekDecisionCounts(
  decisionEntries: Record<string, DecisionEntry>,
  weekStartISO: string,
  weekEndISO: string,
): WeekDecisionCounts {
  const inWeek = Object.values(decisionEntries).filter(
    (e) => e.eventDate >= weekStartISO && e.eventDate <= weekEndISO,
  );
  return {
    total: inWeek.length,
    accepted: inWeek.filter((e) => e.decision === 'accepted').length,
    overriddenOrRejected: inWeek.filter((e) => e.decision === 'overridden' || e.decision === 'rejected').length,
    manual: inWeek.filter((e) => e.decision === 'manual').length,
    followUpsRecorded: inWeek.filter((e) => e.followUp).length,
    insufficientOrNotComparable: inWeek.filter(
      (e) => e.followUp && (e.followUp.outcome === 'insufficientData' || e.followUp.outcome === 'notComparable'),
    ).length,
  };
}

/** True when the entry was written on a later day than the decision it records. */
export function isRetrospective(entry: DecisionEntry): boolean {
  return entry.createdAt.slice(0, 10) > entry.eventDate;
}
