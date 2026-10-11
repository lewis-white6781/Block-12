// The day's tick boxes — SPEC-V6.0.md section 2. Handstand + mobility every
// day, football on Wednesday and Friday. One tap each, nothing listed inside:
// the plan prescribes them as done / not done.
import { dailyChecksFor } from '../data/program';
import type { DayId } from '../domain/types';
import { useStore } from '../store/useStore';

interface DailyChecksProps {
  date: string;
  day: DayId;
}

export default function DailyChecks({ date, day }: DailyChecksProps) {
  const entry = useStore((s) => s.dailyEntries[date]);
  const toggleDailyCheck = useStore((s) => s.toggleDailyCheck);

  return (
    <div className="space-y-2">
      {dailyChecksFor(day).map((check) => {
        const done = !!entry?.checks?.[check.id];
        return (
          <button
            key={check.id}
            type="button"
            role="checkbox"
            aria-checked={done}
            onClick={() => toggleDailyCheck(date, check.id)}
            className={`flex min-h-11 w-full items-center gap-3 rounded border px-3 py-2 text-left ${
              done ? 'border-good bg-surface-2' : 'border-line bg-surface'
            }`}
          >
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-sm ${
                done ? 'border-good bg-good text-bg' : 'border-muted text-transparent'
              }`}
            >
              ✓
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-text">{check.label}</span>
              {check.detail && <span className="block text-xs text-muted">{check.detail}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
