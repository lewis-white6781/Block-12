// SPEC.md section 7.2 — "Numbers entered via a custom number pad sheet, not the OS keyboard."
import { useEffect, useState } from 'react';
import Sheet from './Sheet';

interface NumberPadProps {
  open: boolean;
  label: string;
  value: number | undefined;
  allowDecimal?: boolean;
  onConfirm: (value: number) => void;
  onClose: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export default function NumberPad({ open, label, value, allowDecimal, onConfirm, onClose }: NumberPadProps) {
  const [buffer, setBuffer] = useState('');

  // Returning null while closed keeps this component mounted (its parent doesn't
  // unmount it), so the buffer must be reset explicitly on every open — otherwise
  // reopening on a field that already has a value appends new digits to the old
  // one instead of starting a fresh entry.
  useEffect(() => {
    if (open) setBuffer('');
  }, [open]);

  if (!open) return null;

  function press(key: string) {
    if (key === '⌫') {
      setBuffer((b) => b.slice(0, -1));
      return;
    }
    if (key === '.' && (!allowDecimal || buffer.includes('.'))) return;
    setBuffer((b) => (b === '0' ? key : b + key));
  }

  function confirm() {
    const parsed = parseFloat(buffer);
    if (!Number.isNaN(parsed)) onConfirm(parsed);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={label}>
      {value !== undefined && (
        <div className="mb-1 text-right text-xs text-muted">current: {value}</div>
      )}
      <div className="mb-4 rounded border border-line bg-surface-2 px-4 py-3 text-right font-display text-4xl tabular-nums text-text">
        {buffer || '0'}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="min-h-11 rounded border border-line bg-surface-2 text-xl text-text active:bg-line"
          >
            {key}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={confirm}
        className="mt-3 min-h-11 w-full rounded bg-good text-base font-medium text-bg"
      >
        Done
      </button>
    </Sheet>
  );
}
