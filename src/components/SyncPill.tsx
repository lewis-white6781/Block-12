// Sync status, on every screen — SPEC-V3.0.md section 6.
//
// The status used to live only in Settings, which meant the question the
// athlete actually asks — "is this device showing what my other device has?" —
// took three taps to answer, and there was no signal at all that a set logged
// at the gym on a flaky connection had not made it up yet.
//
// Tapping it forces a sync rather than navigating away, so the answer and the
// remedy are the same control.
import { useSyncStore } from '../sync/syncStore';
import { runSync } from '../sync/syncEngine';

/** Minutes since a sync stopped counting as "just now". */
const STALE_MINUTES = 10;

export default function SyncPill() {
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

  const staleFor =
    lastSyncedAt !== null ? (Date.now() - new Date(lastSyncedAt).getTime()) / 60_000 : null;

  // 'idle' is the engine's word for "settled", which is either synced or
  // never-synced. They mean very different things to the athlete, so they
  // are not shown the same way.
  const { label, tone } =
    status === 'syncing'
      ? { label: 'Syncing…', tone: 'text-muted' }
      : status === 'offline'
        ? { label: 'Offline', tone: 'text-warn' }
        : status === 'error'
          ? { label: 'Sync failed', tone: 'text-bad' }
          : lastSyncedAt === null
            ? { label: 'Not synced', tone: 'text-muted' }
            : staleFor !== null && staleFor > STALE_MINUTES
              ? { label: `Synced ${Math.round(staleFor)}m ago`, tone: 'text-muted' }
              : { label: 'Synced', tone: 'text-good' };

  return (
    <button
      type="button"
      onClick={() => void runSync()}
      aria-label={`${label}. Tap to sync now.`}
      className={`shrink-0 text-xs ${tone}`}
    >
      {status === 'syncing' ? '⟳' : '•'} {label}
    </button>
  );
}
