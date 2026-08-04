// A live "today" — SPEC-V3.0.md section 4.
//
// THE BUG THIS EXISTS TO FIX: screens used to capture `startOfToday()` once, in
// a `useState` initialiser or a render-time const. An installed PWA is rarely
// reloaded — it is left on the home screen for weeks — so after midnight the
// captured value was yesterday. The Today pager's forward bound is "today", so
// it silently refused to advance, and there was no reload button in a
// standalone iOS PWA to recover with.
//
// Resync happens on the two events that actually matter: returning to the app
// (visibilitychange/focus, which is when a user would notice), and the local
// midnight boundary itself for an app left open across it.
import { useEffect, useState } from 'react';
import { startOfToday } from '../domain/clock';

function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  // +1s of slack so the timer never fires a hair before the boundary and
  // re-reads the same day, which would then re-arm for ~0 ms in a tight loop.
  return next.getTime() - now.getTime() + 1000;
}

/**
 * Today's date at local midnight, kept current. The returned Date is stable
 * (same reference) until the calendar day actually changes, so it is safe in a
 * dependency array.
 */
export function useToday(): Date {
  const [today, setToday] = useState(startOfToday);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function sync() {
      const current = startOfToday();
      // Compare by value; only swap the reference when the day really changed,
      // so consumers memoised on this don't recompute every visibility flip.
      setToday((prev) => (prev.getTime() === current.getTime() ? prev : current));
      clearTimeout(timer);
      timer = setTimeout(sync, msUntilNextLocalMidnight(new Date()));
    }

    function onVisible() {
      if (document.visibilityState === 'visible') sync();
    }

    sync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', sync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', sync);
    };
  }, []);

  return today;
}
