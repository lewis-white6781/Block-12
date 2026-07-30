// SPEC.md section 7.1–7.2.
import type { Exercise, Prescription } from '../domain/types';

export function formatPrescription(prescription: Prescription | null): string {
  if (!prescription) return '—';
  const parts: string[] = [`${prescription.sets}×`];

  if (prescription.repsLow !== undefined) {
    parts.push(
      prescription.repsLow === prescription.repsHigh
        ? `${prescription.repsLow}`
        : `${prescription.repsLow}–${prescription.repsHigh}`,
    );
  }
  if (prescription.secLow !== undefined) {
    parts.push(
      (prescription.secLow === prescription.secHigh
        ? `${prescription.secLow}`
        : `${prescription.secLow}–${prescription.secHigh}`) + 's',
    );
  }
  if (prescription.perSide) parts.push('/side');

  let text = parts.join(' ').replace('× ', '×');
  if (prescription.rpeLow !== undefined) {
    text +=
      prescription.rpeLow === prescription.rpeHigh
        ? ` RPE${prescription.rpeLow}`
        : ` RPE${prescription.rpeLow}–${prescription.rpeHigh}`;
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
      </span>
      <span className="shrink-0 tabular-nums text-muted">{formatPrescription(prescription)}</span>
    </div>
  );
}
