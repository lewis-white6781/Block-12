// SPEC.md section 6.8 — "when saving a ProgressionEvent" the one-variable
// rule blocks (with an overridable warning) a second change to the same
// exercise in the same week. This is the only place a ProgressionEvent gets
// created, so it's also where that check has to live.
import { useState } from 'react';
import { nextProgressionAxis, oneVariableWarning } from '../domain/analysis';
import { newId } from '../domain/id';
import type { Exercise, ProgressionEvent } from '../domain/types';

interface ProgressionLoggerProps {
  exercise: Exercise;
  date: string;
  week: number;
  progressionEvents: ProgressionEvent[];
  weekOfDate: (date: string) => number;
  onSave: (event: ProgressionEvent) => void;
}

export default function ProgressionLogger({
  exercise,
  date,
  week,
  progressionEvents,
  weekOfDate,
  onSave,
}: ProgressionLoggerProps) {
  const [open, setOpen] = useState(false);
  const [axis, setAxis] = useState(() => nextProgressionAxis(exercise, progressionEvents) ?? exercise.progressionLadder[0]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function reset() {
    setOpen(false);
    setWarning(null);
    setFrom('');
    setTo('');
    setAxis(nextProgressionAxis(exercise, progressionEvents) ?? exercise.progressionLadder[0]);
  }

  function save(overrideNote?: string) {
    onSave({
      id: newId(),
      date,
      exerciseId: exercise.id,
      axis,
      from,
      to,
      note: overrideNote,
    });
    setSaved(true);
    reset();
  }

  function handleSaveTap() {
    const blockingMessage = oneVariableWarning(progressionEvents, exercise.id, week, weekOfDate);
    if (blockingMessage) {
      setWarning(blockingMessage);
      return;
    }
    save();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 min-h-11 w-full rounded border border-line text-sm text-text"
      >
        {saved ? 'Log another progression' : 'Log a progression on this exercise'}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded border border-line bg-surface p-3">
      <div className="text-xs uppercase tracking-wide text-muted">Progression</div>
      <label className="mt-2 block text-sm">
        <span className="text-xs text-muted">Axis</span>
        <select
          value={axis}
          onChange={(e) => setAxis(e.target.value)}
          className="mt-1 min-h-11 w-full rounded border border-line bg-surface-2 px-2 text-text"
        >
          {exercise.progressionLadder.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 flex gap-2">
        <label className="flex-1 text-sm">
          <span className="text-xs text-muted">From</span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 min-h-11 w-full rounded border border-line bg-surface-2 px-2 text-text"
          />
        </label>
        <label className="flex-1 text-sm">
          <span className="text-xs text-muted">To</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 min-h-11 w-full rounded border border-line bg-surface-2 px-2 text-text"
          />
        </label>
      </div>

      {warning && (
        <div className="mt-3 rounded bg-warn px-3 py-2 text-sm text-bg">
          {warning}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => save('Logged despite one-variable-rule warning.')}
              className="min-h-11 flex-1 rounded bg-bg text-sm text-text"
            >
              Log it anyway
            </button>
            <button
              type="button"
              onClick={() => setWarning(null)}
              className="min-h-11 flex-1 rounded border border-bg text-sm text-bg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!warning && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={reset} className="min-h-11 flex-1 rounded border border-line text-sm text-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveTap}
            className="min-h-11 flex-1 rounded bg-good text-sm font-medium text-bg"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
