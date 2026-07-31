// SPEC.md section 7.1 (inline daily entry) and 7.4 ("one-tap entry for today ...; back-fill any date").
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { corridorStatus, rolling7Weight, weeklyRateKg } from '../domain/body';
import { convertWeight, parseWeight } from '../domain/units';
import NumberPad from './NumberPad';

interface DailyEntryFieldsProps {
  date: string;
  showSummary?: boolean;
}

type PadField = 'weight' | 'calories' | 'protein';

export default function DailyEntryFields({ date, showSummary }: DailyEntryFieldsProps) {
  const dailyEntries = useStore((s) => s.dailyEntries);
  const upsertDailyEntry = useStore((s) => s.upsertDailyEntry);
  const settings = useStore((s) => s.settings);
  const unit = settings.weightUnit;
  const [padField, setPadField] = useState<PadField | null>(null);

  const entry = dailyEntries[date];
  const entriesArray = Object.values(dailyEntries);
  const rolling = rolling7Weight(entriesArray, date);
  const rate = weeklyRateKg(entriesArray, date);
  const status = corridorStatus(rate);

  const displayWeightKg = entry?.weightKg !== undefined ? Number(convertWeight(entry.weightKg, unit).toFixed(1)) : undefined;

  function save(field: 'weightKg' | 'calories' | 'proteinG', value: number) {
    upsertDailyEntry({ date, [field]: value });
  }

  return (
    <div>
      <div className="flex gap-2">
        <EntryField
          label="Weight"
          unit={` ${unit}`}
          value={displayWeightKg}
          onTap={() => setPadField('weight')}
        />
        <EntryField label="Calories" unit="" value={entry?.calories} onTap={() => setPadField('calories')} />
        <EntryField label="Protein" unit=" g" value={entry?.proteinG} onTap={() => setPadField('protein')} />
      </div>

      {showSummary && rolling !== null && (
        <p className="mt-2 text-xs text-muted">
          7-day avg {convertWeight(rolling, unit).toFixed(1)} {unit}
          {rate !== null &&
            ` · ${rate <= 0 ? '−' : '+'}${Math.abs(convertWeight(rate, unit)).toFixed(2)} ${unit}/wk`}
          {status === 'onTrack' && ' ✓'}
        </p>
      )}

      <NumberPad
        open={padField === 'weight'}
        label={`Weight (${unit})`}
        value={displayWeightKg}
        allowDecimal
        onConfirm={(v) => save('weightKg', parseWeight(v, unit))}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'calories'}
        label="Calories"
        value={entry?.calories}
        onConfirm={(v) => save('calories', v)}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'protein'}
        label="Protein (g)"
        value={entry?.proteinG}
        onConfirm={(v) => save('proteinG', v)}
        onClose={() => setPadField(null)}
      />
    </div>
  );
}

function EntryField({
  label,
  unit,
  value,
  onTap,
}: {
  label: string;
  unit: string;
  value: number | undefined;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="min-h-11 flex-1 rounded border border-line bg-surface-2 px-2 text-left"
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular-nums text-text">{value !== undefined ? `${value}${unit}` : '—'}</div>
    </button>
  );
}
