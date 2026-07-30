// SPEC.md section 7.2 (custom number pad sheet).
import type { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-[10px] border-t border-line bg-surface p-4 pb-6">
        {title && (
          <div className="mb-3 text-xs uppercase tracking-wide text-muted">{title}</div>
        )}
        {children}
      </div>
    </div>
  );
}
