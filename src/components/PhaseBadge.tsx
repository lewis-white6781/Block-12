// SPEC.md section 7.1 header row + section 8's persistent 12-segment block bar.
import type { Phase } from '../domain/types';

const PHASE_LABEL: Record<Phase, string> = {
  calibration: 'CALIBRATION',
  accumulation: 'ACCUMULATION',
  deload: 'DELOAD',
  intensification: 'INTENSIFICATION',
  peak: 'PEAK',
  taper: 'TAPER',
  test: 'TEST',
};

interface PhaseBadgeProps {
  week: number;
  phase: Phase;
  dateLabel: string;
}

export default function PhaseBadge({ week, phase, dateLabel }: PhaseBadgeProps) {
  return (
    <div className="border-b border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg tracking-wide" style={{ color: `var(--${phase})` }}>
          WEEK {String(week).padStart(2, '0')} {PHASE_LABEL[phase]}
        </span>
        <span className="text-sm text-muted">{dateLabel}</span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
          <div
            key={w}
            className="h-1.5 flex-1 rounded-full"
            style={{
              backgroundColor: w <= week ? `var(--${phase})` : 'var(--line)',
              opacity: w === week ? 1 : w < week ? 0.6 : 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}
