// Sync orchestration: pull -> merge -> apply locally -> push. Never throws
// into callers, never clears local state on failure — local writes always
// win over a failed sync, and the next successful sync reconciles.
import { supabase } from '../lib/supabaseClient';
import { migrate, toPersistedState, SCHEMA_VERSION } from '../store/persist';
import type { PersistedState } from '../store/persist';
import { useStore } from '../store/useStore';
import { mergeState } from './merge';
import { useSyncStore } from './syncStore';

const TABLE = 'block_state';

/**
 * Extracts a human-readable message from whatever runSync's try block threw.
 *
 * supabase-js throws a PostgrestError — a plain object with `message`,
 * `details`, `hint` and `code` fields — not a JS `Error`. `err instanceof
 * Error` is therefore false for the exact errors this function most needs to
 * surface (missing table, RLS denial, bad column), and the UI fell through to
 * a generic "Sync failed." with no way to diagnose it from the device.
 */
export function syncErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      const code = 'code' in err ? (err as { code: unknown }).code : undefined;
      return typeof code === 'string' && code.length > 0 ? `${message} (${code})` : message;
    }
  }
  return 'Sync failed.';
}

interface BlockStateRow {
  user_id: string;
  schema_version: number;
  settings: unknown;
  daily_entries: unknown;
  session_logs: unknown;
  benchmark_entries: unknown;
  progression_events: unknown;
  updated_at: string;
}

/** A pulled row plus the `updated_at` it carried, for the compare-and-set below. */
interface PullResult {
  state: PersistedState | null;
  updatedAt: string | null;
}

async function pullRemote(userId: string): Promise<PullResult> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return { state: null, updatedAt: null };

  const row = data as BlockStateRow;
  return {
    updatedAt: row.updated_at,
    state: migrate(
      {
        schemaVersion: row.schema_version,
        settings: row.settings,
        dailyEntries: row.daily_entries,
        sessionLogs: row.session_logs,
        benchmarkEntries: row.benchmark_entries,
        progressionEvents: row.progression_events,
      },
      row.schema_version,
    ),
  };
}

/** Just the row's `updated_at`, to check nothing landed between pull and push. */
async function remoteUpdatedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { updated_at: string } | null)?.updated_at ?? null;
}

async function pushRemote(userId: string, state: PersistedState): Promise<void> {
  const row = {
    user_id: userId,
    schema_version: SCHEMA_VERSION,
    settings: state.settings,
    daily_entries: state.dailyEntries,
    session_logs: state.sessionLogs,
    benchmark_entries: state.benchmarkEntries,
    progression_events: state.progressionEvents,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

let syncInFlight = false;
/** `updated_at` of the row the most recent pull read, for the compare-and-set. */
let lastPulledUpdatedAt: string | null = null;

/** Pulls, merges against local, applies the result to the store, returns it. */
async function pullMergeApply(userId: string): Promise<PersistedState> {
  const { state: remote, updatedAt } = await pullRemote(userId);
  lastPulledUpdatedAt = updatedAt;

  const local = toPersistedState(useStore.getState());
  const merged = remote ? mergeState(local, remote) : local;
  useStore.setState(merged);
  return merged;
}

export async function runSync(): Promise<void> {
  if (syncInFlight) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return; // Not signed in — nothing to sync.

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSyncStore.getState().setOffline();
    return;
  }

  syncInFlight = true;
  useSyncStore.getState().setSyncing();

  try {
    // Pull -> merge -> apply -> push, with one compare-and-set retry.
    //
    // The push is a blind upsert of the whole blob, so another device writing
    // between our pull and our push would be overwritten wholesale. Nothing
    // was ever permanently lost — the loser re-merged our blob on its next
    // sync within ~30s — but the athlete saw a set appear, vanish, and come
    // back. Re-reading updated_at immediately before pushing removes that
    // flip-flop (SPEC-V3.0.md section 6).
    //
    // One retry, not a loop: two devices racing repeatedly is not a real
    // pattern for one person, and a loop here could spin against a clock-skewed
    // peer. If the second attempt also races, the existing 30s cadence
    // reconciles it exactly as before.
    let merged = await pullMergeApply(userId);

    const before = await remoteUpdatedAt(userId);
    if (before !== null && lastPulledUpdatedAt !== null && before !== lastPulledUpdatedAt) {
      merged = await pullMergeApply(userId);
    }

    await pushRemote(userId, merged);

    useSyncStore.getState().setSynced();
  } catch (err) {
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline) {
      useSyncStore.getState().setOffline();
    } else {
      useSyncStore.getState().setError(syncErrorMessage(err));
    }
  } finally {
    syncInFlight = false;
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeStore: (() => void) | null = null;

/** Wires up all sync triggers: debounced local writes, foreground, reconnect, and a 30s interval. Call once after sign-in. */
export function startSyncTriggers(): () => void {
  // Debounced trigger on local mutations.
  unsubscribeStore = useStore.subscribe(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void runSync();
    }, 2000);
  });

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void runSync();
  };
  const onOnline = () => void runSync();

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', onOnline);

  intervalTimer = setInterval(() => void runSync(), 30_000);

  // Initial sync on mount (e.g. right after sign-in).
  void runSync();

  return function stopSyncTriggers() {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (intervalTimer) clearInterval(intervalTimer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('online', onOnline);
    unsubscribeStore?.();
  };
}
