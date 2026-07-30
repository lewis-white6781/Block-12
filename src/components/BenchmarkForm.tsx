// SPEC.md sections 5.9, 5.7 ("in those weeks the Sunday screen opens the
// Benchmark form instead of the checklist"), 7.6.
import { useState } from 'react';
import { format } from 'date-fns';
import { useStore } from '../store/useStore';
import { benchmarks } from '../data/mobility';
import NumberPad from './NumberPad';

interface BenchmarkFormProps {
  week: number;
}

export default function BenchmarkForm({ week }: BenchmarkFormProps) {
  const benchmarkEntries = useStore((s) => s.benchmarkEntries);
  const upsertBenchmarkEntry = useStore((s) => s.upsertBenchmarkEntry);
  const existing = benchmarkEntries.find((b) => b.week === week);

  const [values, setValues] = useState<Record<string, number>>(existing?.values ?? {});
  const [photoNote, setPhotoNote] = useState(existing?.photoNote ?? '');
  const [padField, setPadField] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    upsertBenchmarkEntry({
      date: existing?.date ?? format(new Date(), 'yyyy-MM-dd'),
      week,
      values,
      photoNote: photoNote || undefined,
    });
    setSaved(true);
  }

  return (
    <div className="rounded border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-text">Mobility benchmarks · week {week}</span>
        {(existing || saved) && <span className="text-xs text-good">Saved ✓</span>}
      </div>

      <div className="mt-2 divide-y divide-line">
        {benchmarks.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setPadField(b.id)}
            className="flex min-h-11 w-full items-center justify-between gap-2 py-1.5 text-left text-sm"
          >
            <span className="text-text">
              {b.label}
              {b.targetNote && <span className="ml-1 text-xs text-muted">({b.targetNote})</span>}
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              {values[b.id] !== undefined ? `${values[b.id]} ${b.unit}` : '—'}
            </span>
          </button>
        ))}
      </div>

      <label className="mt-3 block text-sm">
        <span className="text-xs text-muted">Photo note</span>
        <input
          type="text"
          value={photoNote}
          onChange={(e) => {
            setPhotoNote(e.target.value);
            setSaved(false);
          }}
          className="mt-1 min-h-11 w-full rounded border border-line bg-surface-2 px-2 text-text"
        />
      </label>

      <button
        type="button"
        onClick={save}
        className="mt-3 min-h-11 w-full rounded bg-good text-base font-medium text-bg"
      >
        Save benchmarks
      </button>

      {benchmarks.map((b) => (
        <NumberPad
          key={b.id}
          open={padField === b.id}
          label={`${b.label} (${b.unit})`}
          value={values[b.id]}
          allowDecimal
          onConfirm={(v) => {
            setValues((vals) => ({ ...vals, [b.id]: v }));
            setSaved(false);
          }}
          onClose={() => setPadField(null)}
        />
      ))}
    </div>
  );
}
