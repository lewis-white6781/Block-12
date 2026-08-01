// Multi-device sync merge algorithm — last-write-wins per entity key.
// Pure function, zero dependencies on Supabase/React/zustand.
import type { PersistedState } from '../store/persist';
import type { BenchmarkEntry, DailyEntry, ProgressionEvent, SessionLog } from '../domain/types';

function mergeByKeyLWW<T extends { updatedAt: string }>(
  local: Record<string, T>,
  remote: Record<string, T>,
): Record<string, T> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const out: Record<string, T> = {};
  for (const key of keys) {
    const l = local[key];
    const r = remote[key];
    // One-sided: if only on one side, take it.
    // Both present: newer updatedAt wins; equal timestamps prefer local (stable, arbitrary).
    out[key] = !l ? r : !r ? l : r.updatedAt > l.updatedAt ? r : l;
  }
  return out;
}

export function mergeState(local: PersistedState, remote: PersistedState): PersistedState {
  return {
    schemaVersion: local.schemaVersion, // Caller has already migrated both to the same version
    settings: remote.settings.updatedAt > local.settings.updatedAt ? remote.settings : local.settings,
    dailyEntries: mergeByKeyLWW<DailyEntry>(local.dailyEntries, remote.dailyEntries),
    sessionLogs: mergeByKeyLWW<SessionLog>(local.sessionLogs, remote.sessionLogs),
    benchmarkEntries: mergeByKeyLWW<BenchmarkEntry>(local.benchmarkEntries, remote.benchmarkEntries),
    progressionEvents: mergeProgressionEvents(local.progressionEvents, remote.progressionEvents),
  };
}

function mergeProgressionEvents(local: ProgressionEvent[], remote: ProgressionEvent[]): ProgressionEvent[] {
  // Union by id; immutable, append-only, so no conflict possible.
  const byId = new Map(local.map((e) => [e.id, e]));
  for (const e of remote) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}
