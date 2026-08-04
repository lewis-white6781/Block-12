// Shared back/forward pager — consolidates the identical <- center -> pattern
// used for day/week navigation (Today.tsx, Program.tsx, Review.tsx).
import type { ReactNode } from 'react';

interface PagerNavProps {
  onPrev: () => void;
  onNext: () => void;
  disablePrev?: boolean;
  disableNext?: boolean;
  center: ReactNode;
  /** Defaults to a compact inline cluster; pass "flex w-full items-center justify-between" for a full-width bar with arrows pinned to the edges. */
  className?: string;
}

export default function PagerNav({ onPrev, onNext, disablePrev, disableNext, center, className }: PagerNavProps) {
  return (
    <div className={className ?? 'flex items-center gap-2'}>
      <button
        type="button"
        disabled={disablePrev}
        onClick={onPrev}
        className="min-h-11 min-w-11 text-text disabled:opacity-30"
      >
        ←
      </button>
      {center}
      <button
        type="button"
        disabled={disableNext}
        onClick={onNext}
        className="min-h-11 min-w-11 text-text disabled:opacity-30"
      >
        →
      </button>
    </div>
  );
}
