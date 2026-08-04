// SPEC.md section 7.1 (inline daily entry) and 7.4 ("one-tap entry for today ...; back-fill any date").
// Macros (SPEC-V1.1.md section 3): typing protein/carbs/fat auto-fills calories
// at 4/4/9 kcal/g unless calories has been typed directly, in which case that
// value wins and a mismatch hint shows if it disagrees with the macro sum.
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { caloriesFromMacros, corridorStatus, rolling7Weight, weeklyRateKg } from '../domain/body';
import { convertWeight, fmtKg, fmtKgSigned, parseWeight } from '../domain/units';
import { roundTo } from '../domain/format';
import type { DailyEntry } from '../domain/types';
import NumberPad from './NumberPad';

interface DailyEntryFieldsProps {
  date: string;
  showSummary?: boolean;
}

type PadField = 'weight' | 'calories' | 'protein' | 'carbs' | 'fat';
type MacroField = 'proteinG' | 'carbsG' | 'fatG';

const MISMATCH_THRESHOLD = 5; // kcal — floating point / rounding slack, not a real disagreement

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

  // Numeric (not string) — this feeds NumberPad's initial value, not a label.
  const displayWeightKg = entry?.weightKg !== undefined ? roundTo(convertWeight(entry.weightKg, unit), 1) : undefined;

  const computedCalories = caloriesFromMacros(entry?.proteinG ?? 0, entry?.carbsG ?? 0, entry?.fatG ?? 0);
  const hasAnyMacro = entry?.proteinG !== undefined || entry?.carbsG !== undefined || entry?.fatG !== undefined;
  const showMismatchHint =
    !!entry?.caloriesOverridden &&
    entry?.calories !== undefined &&
    hasAnyMacro &&
    Math.abs(entry.calories - computedCalories) > MISMATCH_THRESHOLD;

  function saveWeight(value: number) {
    upsertDailyEntry({ date, weightKg: parseWeight(value, unit) });
  }

  function saveMacro(field: MacroField, value: number) {
    const proteinG = field === 'proteinG' ? value : entry?.proteinG ?? 0;
    const carbsG = field === 'carbsG' ? value : entry?.carbsG ?? 0;
    const fatG = field === 'fatG' ? value : entry?.fatG ?? 0;
    const patch: Partial<DailyEntry> & { date: string } = { date, [field]: value };
    if (!entry?.caloriesOverridden) {
      patch.calories = caloriesFromMacros(proteinG, carbsG, fatG);
    }
    upsertDailyEntry(patch);
  }

  function saveCalories(value: number) {
    upsertDailyEntry({ date, calories: value, caloriesOverridden: true });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <EntryField label="Weight" unit={` ${unit}`} value={displayWeightKg} onTap={() => setPadField('weight')} />
        <EntryField
          label="Calories"
          unit=""
          value={entry?.calories}
          warn={showMismatchHint}
          onTap={() => setPadField('calories')}
        />
        <EntryField label="Protein" unit=" g" value={entry?.proteinG} onTap={() => setPadField('protein')} />
        <EntryField label="Carbs" unit=" g" value={entry?.carbsG} onTap={() => setPadField('carbs')} />
        <EntryField label="Fat" unit=" g" value={entry?.fatG} onTap={() => setPadField('fat')} />
      </div>

      {showMismatchHint && (
        <p className="mt-2 text-xs text-warn">
          Calories don't match macros — 4/4/9 gives {Math.round(computedCalories)} kcal.
        </p>
      )}

      {showSummary && rolling !== null && (
        <p className="mt-2 text-xs text-muted">
          7-day avg {fmtKg(rolling, unit)} {unit}
          {rate !== null && ` · ${fmtKgSigned(rate, unit)} ${unit}/wk`}
          {status === 'onTrack' && ' ✓'}
        </p>
      )}

      <NumberPad
        open={padField === 'weight'}
        label={`Weight (${unit})`}
        value={displayWeightKg}
        allowDecimal
        onConfirm={saveWeight}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'calories'}
        label="Calories"
        value={entry?.calories}
        onConfirm={saveCalories}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'protein'}
        label="Protein (g)"
        value={entry?.proteinG}
        onConfirm={(v) => saveMacro('proteinG', v)}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'carbs'}
        label="Carbs (g)"
        value={entry?.carbsG}
        onConfirm={(v) => saveMacro('carbsG', v)}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'fat'}
        label="Fat (g)"
        value={entry?.fatG}
        onConfirm={(v) => saveMacro('fatG', v)}
        onClose={() => setPadField(null)}
      />
    </div>
  );
}

function EntryField({
  label,
  unit,
  value,
  warn,
  onTap,
}: {
  label: string;
  unit: string;
  value: number | undefined;
  warn?: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="min-h-11 rounded border border-line bg-surface-2 px-2 text-left"
    >
      <div className="text-xs text-muted">
        {label}
        {warn && <span className="ml-1 text-warn">•</span>}
      </div>
      <div className="tabular-nums text-text">{value !== undefined ? `${value}${unit}` : '—'}</div>
    </button>
  );
}
