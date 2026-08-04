// Recharts tooltip/axis formatters — SPEC-V3.0.md section 7.
//
// recharts prints whatever number it is handed, so a raw float reaches the
// tooltip at full double precision (the cut-corridor band was rendering
// "76.94642857142858"). Every chart routes its tooltip and axis ticks through
// here so the 2 dp ceiling applies to charts, not just to text.
//
// The signatures use recharts' own `ValueType` rather than a hand-written
// union, because it is `ReadonlyArray`-based and nullable — a range series such
// as the corridor band arrives as a two-element readonly array, and a gap in
// the data arrives as `undefined`. Matching it exactly means no call site needs
// a cast.
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { fmt } from '../domain/format';

function one(value: number | string, dp: number): string {
  return typeof value === 'number' ? fmt(value, dp) : value;
}

/**
 * Formats a tooltip value, collapsing a range series to "low–high".
 * `suffix` is appended once, after the range, e.g. "72.5–74.5 kg".
 */
export function tooltipFormatter(dp = 2, suffix = '') {
  return (value: ValueType | undefined): string => {
    if (value === undefined) return '—';
    const body = Array.isArray(value)
      ? value.map((v: number | string) => one(v, dp)).join('–')
      : one(value as number | string, dp);
    return suffix ? `${body} ${suffix}` : body;
  };
}

/** Formats an axis tick. */
export function axisFormatter(dp = 1) {
  return (value: number | string): string => one(value, dp);
}
