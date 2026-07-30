// SPEC.md section 7.2 — persistent rest bar, audible + vibration at zero,
// visible even while scrolling. Mount with a changing `key` prop to restart it.
import { useEffect, useState } from 'react';

interface RestTimerProps {
  seconds: number;
  onDone?: () => void;
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Web Audio unavailable — silently skip the beep.
  }
}

export default function RestTimer({ seconds, onDone }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      navigator.vibrate?.(400);
      beep();
      onDone?.();
      return;
    }
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  const mm = Math.floor(Math.max(0, remaining) / 60);
  const ss = Math.max(0, remaining) % 60;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between bg-surface-2 px-4 py-2">
      <span className="text-xs uppercase tracking-wide text-muted">Rest</span>
      <span className="font-display text-xl tabular-nums text-text">
        {mm}:{String(ss).padStart(2, '0')}
      </span>
    </div>
  );
}
