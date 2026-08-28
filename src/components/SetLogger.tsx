// SPEC.md section 7.2 — custom number pad + RPE stepper, per-metric set input.
// v4.0 (SPEC-V4.0.md section 2): run and carry inputs, and an RPE stepper whose
// bounds follow the exercise's own RPE table.
import type { MetricType, RpeScale, TechniqueFlag } from '../domain/types';
import HoldTimer from './HoldTimer';

/**
 * SPEC-V4.0.md section 1 defines three RPE tables and they do not share bounds.
 * The 6–10 strength range made an easy run at RPE 2 literally unloggable, and
 * flexibility work is explicitly never taken past 8.
 */
const RPE_BOUNDS: Record<RpeScale, { min: number; max: number }> = {
  strength: { min: 6, max: 10 },
  stretch: { min: 5, max: 8 },
  run: { min: 1, max: 10 },
};

const FLAG_LABELS: Record<TechniqueFlag, string> = {
  hipsSagged: 'Hips sagged',
  elbowsUnlocked: 'Elbows unlocked',
  lineChanged: 'Line changed',
  usedMomentum: 'Momentum',
  partialROM: 'Partial ROM',
  collapsed: 'Collapsed',
  assistedExtra: 'Extra assist',
};
const ALL_FLAGS = Object.keys(FLAG_LABELS) as TechniqueFlag[];

interface StepperProps {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  onTapNumber?: () => void;
  min?: number;
  max?: number;
  step?: number;
}

export function Stepper({ label, value, onChange, onTapNumber, min = 0, max = 100, step = 1 }: StepperProps) {
  const current = value ?? min;
  return (
    <div>
      {label && <div className="text-xs text-muted">{label}</div>}
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, Math.round((current - step) * 10) / 10))}
          className="min-h-11 min-w-11 rounded border border-line text-text"
        >
          −
        </button>
        <button type="button" onClick={onTapNumber} className="min-h-11 min-w-11 tabular-nums text-text">
          {current}
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, Math.round((current + step) * 10) / 10))}
          className="min-h-11 min-w-11 rounded border border-line text-text"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** A labelled tap target that opens a NumberPad. The house pattern for any typed value. */
function TapField({ label, value, onTap }: { label: string; value: string; onTap: () => void }) {
  return (
    <label className="block flex-1 text-sm">
      <span className="text-xs text-muted">{label}</span>
      <button
        type="button"
        onClick={onTap}
        className="mt-1 min-h-11 w-full rounded border border-line bg-surface-2 px-3 text-left tabular-nums text-text"
      >
        {value}
      </button>
    </label>
  );
}

interface SetLoggerProps {
  metric: MetricType;
  rpeScale: RpeScale;
  reps: number | undefined;
  onRepsChange: (v: number) => void;
  onTapReps: () => void;
  rpe: number | undefined;
  onRpeChange: (v: number) => void;
  seconds: number | undefined;
  attempts: number[];
  onAttempt: (seconds: number) => void;
  onHoldComplete: (seconds: number) => void;
  minutes: number | undefined;
  onTapMinutes: () => void;
  distanceM: number | undefined;
  onTapDistance: () => void;
  intensityPct: number | undefined;
  onTapIntensity: () => void;
  // ROM depth in cm. Rendered only when the exercise progresses on ROM
  // (SPEC-V3.0.md section 2) so the other ~68 exercises gain no extra tap.
  showRom: boolean;
  romCm: number | undefined;
  onTapRom: () => void;
  flags: TechniqueFlag[];
  onToggleFlag: (flag: TechniqueFlag) => void;
  onLogSet: () => void;
}

export default function SetLogger({
  metric,
  rpeScale,
  reps,
  onRepsChange,
  onTapReps,
  rpe,
  onRpeChange,
  seconds,
  attempts,
  onAttempt,
  onHoldComplete,
  minutes,
  onTapMinutes,
  distanceM,
  onTapDistance,
  intensityPct,
  onTapIntensity,
  showRom,
  romCm,
  onTapRom,
  flags,
  onToggleFlag,
  onLogSet,
}: SetLoggerProps) {
  const canLog: Record<MetricType, boolean> = {
    hold: seconds !== undefined && seconds > 0,
    attempts: attempts.length > 0,
    reps: reps !== undefined,
    weightedReps: reps !== undefined,
    runInterval: minutes !== undefined && minutes > 0,
    carry: distanceM !== undefined && distanceM > 0,
    sprint: distanceM !== undefined && distanceM > 0,
    distanceTime: reps !== undefined && reps > 0,
    timeOnly: seconds !== undefined && seconds > 0,
  };

  const bounds = RPE_BOUNDS[rpeScale];
  const rpeStepper = (
    <Stepper label="RPE" value={rpe} min={bounds.min} max={bounds.max} step={0.5} onChange={onRpeChange} />
  );

  return (
    <div>
      {(metric === 'hold' || metric === 'timeOnly') && (
        <div>
          <HoldTimer onComplete={onHoldComplete} />
          {/* v4.0: holds carry an RPE too. Flexibility work is prescribed
              purely by RPE (SPEC-V4.0.md section 1), and before this the whole
              Tuesday and Sunday later-session was logged as bare seconds. */}
          <div className="mt-3">{rpeStepper}</div>
        </div>
      )}

      {metric === 'attempts' && (
        <div>
          <HoldTimer onComplete={onAttempt} />
          <div className="mt-2 flex gap-2 text-sm tabular-nums text-text">
            {attempts.map((a, i) => (
              <span key={i} className="rounded border border-line px-2 py-1">
                {a}s
              </span>
            ))}
          </div>
        </div>
      )}

      {(metric === 'reps' || metric === 'weightedReps') && (
        <div className="flex items-center gap-4">
          <Stepper label="Reps" value={reps} onChange={onRepsChange} onTapNumber={onTapReps} />
          {rpeStepper}
        </div>
      )}

      {metric === 'runInterval' && (
        <div>
          <div className="flex gap-2">
            <TapField label="Minutes" value={minutes !== undefined ? `${minutes} min` : 'Not set'} onTap={onTapMinutes} />
            {/* Optional: logging it is what makes pace derivable at all, but a
                run without it is still a logged run. */}
            <TapField
              label="Distance (m), optional"
              value={distanceM !== undefined ? `${distanceM} m` : '—'}
              onTap={onTapDistance}
            />
          </div>
          <div className="mt-3">{rpeStepper}</div>
        </div>
      )}

      {metric === 'carry' && (
        <div>
          <TapField label="Distance (m)" value={`${distanceM ?? 0} m`} onTap={onTapDistance} />
          <div className="mt-3">{rpeStepper}</div>
        </div>
      )}

      {metric === 'sprint' && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onTapDistance}
            className="min-h-11 flex-1 rounded border border-line bg-surface-2 px-2 tabular-nums text-text"
          >
            {distanceM ?? 0} m
          </button>
          <button
            type="button"
            onClick={onTapIntensity}
            className="min-h-11 flex-1 rounded border border-line bg-surface-2 px-2 tabular-nums text-text"
          >
            {intensityPct ?? 0}%
          </button>
        </div>
      )}

      {metric === 'distanceTime' && (
        <button
          type="button"
          onClick={onTapMinutes}
          className="min-h-11 w-full rounded border border-line bg-surface-2 px-2 tabular-nums text-text"
        >
          {reps ?? 0} min
        </button>
      )}

      {showRom && (
        <div className="mt-3">
          <TapField
            label="Depth — pad height (cm), lower is deeper"
            value={romCm !== undefined ? `${romCm} cm` : 'Not set'}
            onTap={onTapRom}
          />
        </div>
      )}

      {/* Technique flags describe a rep breaking down. A run block has no such
          failure mode — you were slower or you were not. */}
      {metric !== 'distanceTime' && metric !== 'runInterval' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_FLAGS.map((flag) => (
            <button
              key={flag}
              type="button"
              onClick={() => onToggleFlag(flag)}
              className={`min-h-11 rounded-full border px-3 text-xs ${
                flags.includes(flag) ? 'border-warn bg-warn text-bg' : 'border-line text-muted'
              }`}
            >
              ⚑ {FLAG_LABELS[flag]}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={!canLog[metric]}
        onClick={onLogSet}
        className="mt-4 min-h-11 w-full rounded bg-good text-base font-medium text-bg disabled:opacity-40"
      >
        Log set
      </button>
    </div>
  );
}
