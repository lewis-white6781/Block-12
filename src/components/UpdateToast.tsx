// Post-update confirmation — SPEC-V3.0.md section 5, acceptance test 84.
//
// The update itself is silent by design. This exists only so the athlete knows
// afterwards that the app changed under them — otherwise a redesigned screen
// looks like a bug rather than a new version. Shown exactly once per version
// change, then dismissed for good.
import { useEffect, useState } from 'react';
import { useUpdateStore } from '../pwa/updateStore';

const VISIBLE_MS = 6000;

export default function UpdateToast() {
  const justUpdatedFrom = useUpdateStore((s) => s.justUpdatedFrom);
  const version = useUpdateStore((s) => s.version);
  const clearJustUpdated = useUpdateStore((s) => s.clearJustUpdated);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!justUpdatedFrom) return;
    const timer = setTimeout(() => setDismissed(true), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [justUpdatedFrom]);

  if (!justUpdatedFrom || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-50 flex items-center justify-between gap-3 rounded bg-surface-2 px-3 py-2 text-sm text-text shadow-lg"
    >
      <span>Updated to v{version}</span>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          clearJustUpdated();
        }}
        className="min-h-11 shrink-0 px-2 text-xs text-muted"
      >
        Dismiss
      </button>
    </div>
  );
}
