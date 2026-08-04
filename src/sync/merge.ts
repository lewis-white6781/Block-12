// Multi-device sync merge algorithm — last-write-wins per entity key.
// Pure function, zero dependencies on Supabase/React/zustand.
import type { PersistedState } from '../store/persist';
import type { BenchmarkEntry, DailyEntry, ProgressionEvent, SessionLog } from '../domain/types';

/**
 * `resetAt` is the tombstone cutoff — SPEC-V3.0.md section 6.
 *
 * The merge is a union of keys, which has no way to express "this was
 * deleted": a record absent locally and present remotely is indistinguishable
 * from a record created on the other device. So "Reset block" was silently
 * undone by the next pull, which re-added every session it had just deleted.
 * (SPEC-V2.0.md section 5 test 60 asserted otherwise; it was wrong, and
 * SPEC-V3.0.md section 1 corrects it.)
 *
 * The fix reuses the settings LWW that already exists. The reset stamps
 * `settings.resetAt`; whichever settings object wins the merge carries the
 * authoritative cutoff, and any REMOTE record older than it is dropped.
 * Local records are never dropped — a failed or half-applied sync must never
 * cost the athlete data sitting on the device in front of them.
 */
function isTombstoned(record: { updatedAt: string }, resetAt: string | undefined): boolean {
  return resetAt !== undefined && record.updatedAt < resetAt;
}

function mergeByKeyLWW<T extends { updatedAt: string }>(
  local: Record<string, T>,
  remote: Record<string, T>,
  resetAt: string | undefined,
): Record<string, T> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const out: Record<string, T> = {};
  for (const key of keys) {
    const l = local[key];
    // A remote record predating the reset was deleted by it; treat it as absent.
    const r = remote[key] && !isTombstoned(remote[key], resetAt) ? remote[key] : undefined;

    // One-sided: if only on one side, take it.
    // Both present: newer updatedAt wins; equal timestamps prefer local (stable, arbitrary).
    const winner = !l ? r : !r ? l : r.updatedAt > l.updatedAt ? r : l;
    if (winner) out[key] = winner;
  }
  return out;
}

export function mergeState(local: PersistedState, remote: PersistedState): PersistedState {
  const settings = remote.settings.updatedAt > local.settings.updatedAt ? remote.settings : local.settings;
  // The winning settings object carries the authoritative cutoff, so a reset
  // performed on either device is honoured on both.
  const resetAt = settings.resetAt;

  return {
    schemaVersion: local.schemaVersion, // Caller has already migrated both to the same version
    settings,
    dailyEntries: mergeByKeyLWW<DailyEntry>(local.dailyEntries, remote.dailyEntries, resetAt),
    sessionLogs: mergeByKeyLWW<SessionLog>(local.sessionLogs, remote.sessionLogs, resetAt),
    benchmarkEntries: mergeByKeyLWW<BenchmarkEntry>(local.benchmarkEntries, remote.benchmarkEntries, resetAt),
    progressionEvents: mergeProgressionEvents(local.progressionEvents, remote.progressionEvents, resetAt),
  };
}

function mergeProgressionEvents(
  local: ProgressionEvent[],
  remote: ProgressionEvent[],
  resetAt: string | undefined,
): ProgressionEvent[] {
  // Union by id; immutable, append-only, so no conflict possible.
  const byId = new Map(local.map((e) => [e.id, e]));
  for (const e of remote) {
    // ProgressionEvent has no updatedAt (it is immutable), so its `date` is the
    // only timestamp available. It is a yyyy-MM-dd day rather than an instant,
    // so compare against the reset's DAY: an event dated strictly before the
    // reset day was deleted by it. Same-day events survive, which is the safe
    // direction — resurrecting one costs a stale row in a list, dropping a
    // real one loses a progression decision permanently.
    const deleted = resetAt !== undefined && e.date < resetAt.slice(0, 10);
    if (!deleted && !byId.has(e.id)) byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}
