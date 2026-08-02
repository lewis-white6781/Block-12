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

async function pullRemote(userId: string): Promise<PersistedState | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as BlockStateRow;
  return migrate(
    {
      schemaVersion: row.schema_version,
      settings: row.settings,
      dailyEntries: row.daily_entries,
      sessionLogs: row.session_logs,
      benchmarkEntries: row.benchmark_entries,
      progressionEvents: row.progression_events,
    },
    row.schema_version,
  );
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
    const remote = await pullRemote(userId);
    const local = toPersistedState(useStore.getState());
    const merged = remote ? mergeState(local, remote) : local;

    useStore.setState(merged);
    await pushRemote(userId, merged);

    useSyncStore.getState().setSynced();
  } catch (err) {
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline) {
      useSyncStore.getState().setOffline();
    } else {
      const message = err instanceof Error ? err.message : 'Sync failed.';
      useSyncStore.getState().setError(message);
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
