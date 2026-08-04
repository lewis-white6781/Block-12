// Shared input styling — used by Settings.tsx and Auth.tsx, kept in one
// place so the two don't silently diverge (v2.0 had Auth.tsx missing
// tabular-nums that Settings.tsx had).
export const inputClass =
  'min-h-11 w-full rounded border border-line bg-surface-2 px-3 text-base tabular-nums text-text';
