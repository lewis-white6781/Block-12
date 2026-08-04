// SPEC.md section 8 — "Labels are small, uppercase, letterspaced, muted."
// One shared convention for section titles, so every screen reads the same way.
import type { ReactNode } from 'react';

export default function SectionHeader({ children }: { children: ReactNode }) {
  return <h2 className="text-xs uppercase tracking-wide text-muted">{children}</h2>;
}
