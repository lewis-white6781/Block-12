// SPEC.md section 7.2 — "big start/stop, counts up, auto-fills seconds on stop."
import { useEffect, useRef, useState } from 'react';

interface HoldTimerProps {
  onComplete: (seconds: number) => void;
}

export default function HoldTimer({ onComplete }: HoldTimerProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  function start() {
    startedAt.current = Date.now();
    setElapsed(0);
    setRunning(true);
  }

  function stop() {
    setRunning(false);
    onComplete(elapsed);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="font-display text-5xl tabular-nums text-text">{elapsed}s</div>
      <button
        type="button"
        onClick={running ? stop : start}
        className={`min-h-11 w-full rounded text-lg font-medium ${
          running ? 'bg-bad text-bg' : 'bg-good text-bg'
        }`}
      >
        {running ? 'Stop' : 'Start'}
      </button>
    </div>
  );
}
