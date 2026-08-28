// SPEC.md section 7.1–7.2.
import type { Exercise, Prescription } from '../domain/types';

function range(low: number, high: number | undefined): string {
  return low === high || high === undefined ? `${low}` : `${low}–${high}`;
}

export function formatPrescription(prescription: Prescription | null): string {
  if (!prescription) return '—';
  const parts: string[] = [`${prescription.sets}×`];

  if (prescription.repsLow !== undefined) {
    parts.push(range(prescription.repsLow, prescription.repsHigh));
  }
  if (prescription.secLow !== undefined) {
    parts.push(`${range(prescription.secLow, prescription.secHigh)}s`);
  }
  // v4.0 metrics: a run block's duration and a carry's distance.
  if (prescription.minutesEach !== undefined) parts.push(`${prescription.minutesEach} min`);
  if (prescription.distanceM !== undefined) parts.push(`${prescription.distanceM} m`);
  if (prescription.perSide) parts.push('/side');

  let text = parts.join(' ').replace('× ', '×');
  if (prescription.rpeLow !== undefined) {
    text += ` RPE${range(prescription.rpeLow, prescription.rpeHigh)}`;
  }
  if (prescription.note) text += ` — ${prescription.note}`;
  return text.trim();
}

interface ExerciseCardProps {
  order: number;
  exercise: Exercise;
  prescription: Prescription | null;
}

export default function ExerciseCard({ order, exercise, prescription }: ExerciseCardProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-text">
        {order} {exercise.name}
        {/* Marks the alternated pairs and triples — Monday's 7A/7B, Friday's
            6A/6B/6C and 8A/8B. Without it they read as separate slots. */}
        {exercise.supersetId && <span className="ml-1 text-xs text-muted">⇄</span>}
      </span>
      <span className="shrink-0 tabular-nums text-muted">{formatPrescription(prescription)}</span>
    </div>
  );
}
