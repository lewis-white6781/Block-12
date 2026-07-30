// SPEC.md section 7.1 — "5 sliders, ~8 seconds" before entering the Runner.
import { useState } from 'react';
import type { Readiness } from '../domain/types';

interface ReadinessCheckInProps {
  onSubmit: (readiness: Readiness) => void;
  onCancel: () => void;
}

const SCALE_0_3 = [0, 1, 2, 3] as const;

export default function ReadinessCheckIn({ onSubmit, onCancel }: ReadinessCheckInProps) {
  const [sleepHours, setSleepHours] = useState(7);
  const [soreness, setSoreness] = useState<0 | 1 | 2 | 3>(0);
  const [elbowIrritation, setElbowIrritation] = useState<0 | 1 | 2 | 3>(0);
  const [shoulderIrritation, setShoulderIrritation] = useState<0 | 1 | 2 | 3>(0);
  const [motivation, setMotivation] = useState<0 | 1 | 2 | 3>(2);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg p-4">
      <h1 className="font-display text-2xl text-text">Readiness check-in</h1>

      <label className="mt-6 block text-sm text-muted">
        Sleep (hours): <span className="tabular-nums text-text">{sleepHours}</span>
        <input
          type="range"
          min={0}
          max={12}
          step={0.5}
          value={sleepHours}
          onChange={(e) => setSleepHours(parseFloat(e.target.value))}
          className="mt-2 h-11 w-full"
        />
      </label>

      <ScaleField label="Soreness" value={soreness} onChange={setSoreness} />
      <ScaleField label="Elbow irritation" value={elbowIrritation} onChange={setElbowIrritation} />
      <ScaleField label="Shoulder irritation" value={shoulderIrritation} onChange={setShoulderIrritation} />
      <ScaleField label="Motivation" value={motivation} onChange={setMotivation} />

      <div className="mt-auto flex gap-2 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 rounded border border-line text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            onSubmit({ sleepHours, soreness, elbowIrritation, shoulderIrritation, motivation })
          }
          className="min-h-11 flex-1 rounded bg-good text-bg"
        >
          Start session
        </button>
      </div>
    </div>
  );
}

function ScaleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 0 | 1 | 2 | 3;
  onChange: (v: 0 | 1 | 2 | 3) => void;
}) {
  return (
    <div className="mt-5">
      <div className="text-sm text-muted">
        {label}: <span className="tabular-nums text-text">{value}</span>
      </div>
      <div className="mt-2 flex gap-2">
        {SCALE_0_3.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`min-h-11 flex-1 rounded border text-text ${
              value === n ? 'border-text bg-surface-2' : 'border-line'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
