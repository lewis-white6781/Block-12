// SPEC.md section 8 — "no card shadows (flat surfaces + 1px lines), radius 10px, consistently."
// A single source of truth for the flat-surface card pattern used across every screen.
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'danger';
}

export default function Card({ children, className, variant = 'default' }: CardProps) {
  const border = variant === 'danger' ? 'border-bad' : 'border-line';
  return (
    <section className={`rounded border ${border} bg-surface p-3 ${className ?? ''}`.trim()}>
      {children}
    </section>
  );
}
