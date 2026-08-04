// Update detection and the swap decision — SPEC-V3.0.md section 5.
//
// The requirement: a build pushed to Vercel reaches the installed iPhone PWA
// and the desktop browser without the athlete doing anything, without losing
// their place, and without ever interrupting a set.
//
// Nothing here can lose data. All state lives in localStorage and Supabase,
// never in memory only — but a sync is forced before the swap regardless, so a
// set logged seconds earlier is already in the cloud when the page reloads.
import { runSync } from '../sync/syncEngine';
import { useUpdateStore } from './updateStore';

/** Key holding the version the athlete last actually saw running. */
const LAST_SEEN_VERSION_KEY = 'block12:lastSeenVersion';

/** How often to ask the server whether a newer worker exists. */
const UPDATE_CHECK_MS = 15 * 60 * 1000;

let registration: ServiceWorkerRegistration | null = null;
let reloading = false;

/**
 * True when swapping the running build would interrupt something.
 *
 * A session in progress is the case that matters: reloading between sets would
 * drop the athlete back to Today mid-workout. The route is the honest test —
 * SessionRunner owns `#/session/:date/:block` and nothing else does.
 */
function isBusy(): boolean {
  return window.location.hash.startsWith('#/session/');
}

function canApplyNow(): boolean {
  return document.visibilityState === 'visible' && !isBusy();
}

/**
 * Applies a waiting update: flush local writes to Supabase, hand over to the
 * new worker, reload when it takes control.
 */
async function applyUpdate(): Promise<void> {
  const waiting = registration?.waiting;
  if (!waiting || reloading) return;

  useUpdateStore.getState().setApplying();

  // Flush BEFORE the swap. A reload mid-push would otherwise leave the newest
  // sets local-only until the next trigger, which on a phone that then gets
  // pocketed could be a long time. Sync failures are swallowed by runSync
  // itself and must not block the update.
  await runSync();

  localStorage.setItem(LAST_SEEN_VERSION_KEY, __APP_VERSION__);
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/** Called when a worker reaches `installed` with an existing controller. */
function onUpdateReady(): void {
  useUpdateStore.getState().setReady();
  if (canApplyNow()) void applyUpdate();
}

function watchForWaiting(reg: ServiceWorkerRegistration): void {
  // Already waiting when we attached — e.g. installed during a previous visit
  // that was mid-session, or while the tab was in the background.
  if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady();

  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      // `installed` with no controller means this is the FIRST install, not an
      // update — there is no old build to replace and nothing to announce.
      if (installing.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady();
    });
  });
}

/**
 * Registers the worker and keeps it checked. Returns a teardown function.
 * Safe to call when service workers are unavailable — it simply does nothing.
 */
export function startUpdateWatcher(): () => void {
  recordVersionSeen();

  if (!('serviceWorker' in navigator)) return () => {};

  let interval: ReturnType<typeof setInterval> | undefined;

  // controllerchange fires once the new worker takes over. Reload exactly
  // once — without the guard, a controllerchange during the reload itself can
  // re-enter and loop.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      registration = reg;
      watchForWaiting(reg);
      // Ask the server on a slow timer. The foreground check below is the one
      // that actually catches most deploys.
      interval = setInterval(() => void reg.update().catch(() => {}), UPDATE_CHECK_MS);
    })
    .catch(() => {
      // An unavailable worker degrades to "no offline shell, no auto-update".
      // The app itself is unaffected, so this is not worth surfacing.
    });

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    // Returning to the app is the moment to both check and apply: it is when a
    // deploy is most likely to have happened since last look, and when a
    // reload is least disruptive.
    void registration?.update().catch(() => {});
    if (useUpdateStore.getState().phase === 'ready' && canApplyNow()) void applyUpdate();
  };
  const onOnline = () => void registration?.update().catch(() => {});

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);

  return function stopUpdateWatcher() {
    if (interval) clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}

/**
 * Manual "Check for updates" — checks, and applies immediately if one is
 * waiting. Asking explicitly is consent, so this bypasses the mid-session
 * guard the automatic path respects.
 */
export async function checkForUpdateNow(): Promise<void> {
  await registration?.update().catch(() => {});
  if (registration?.waiting) await applyUpdate();
}

/**
 * Compares the running version against the last one seen and records it.
 * Drives the one-time "Updated to vX" toast — stored rather than derived so it
 * shows exactly once, not on every subsequent launch.
 */
function recordVersionSeen(): void {
  try {
    const previous = localStorage.getItem(LAST_SEEN_VERSION_KEY);
    if (previous !== null && previous !== __APP_VERSION__) {
      useUpdateStore.getState().setJustUpdatedFrom(previous);
    }
    localStorage.setItem(LAST_SEEN_VERSION_KEY, __APP_VERSION__);
  } catch {
    // Private mode / storage disabled — the toast is cosmetic, never fatal.
  }
}
