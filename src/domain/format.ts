// Display number formatting — SPEC-V3.0.md section 7.
//
// The single rounding authority for the whole app. NOTHING rendered anywhere
// exceeds 2 decimal places: the cut-corridor band, chart tooltips, weekly
// rates, macro means, added load, all of it.
//
// This is a display concern only. It must never be used on a value on its way
// into the store, into an export, or into src/domain's maths — SPEC-V1.1.md
// section 3's kg-native rule and SPEC.md section 6's pure functions are
// untouched by anything in this file.

/** The hard ceiling. No formatter here accepts a larger `dp`. */
export const MAX_DECIMALS = 2;

function clampDp(dp: number): number {
  return Math.min(MAX_DECIMALS, Math.max(0, Math.trunc(dp)));
}

/**
 * Rounds to 2 dp as a *number*, for values handed to a chart library that will
 * render them itself. `round2(72.499999999999996)` is `72.5`, not a 17-digit
 * float — recharts prints whatever it is given.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rounds to `dp` (0..2) as a number. */
export function roundTo(n: number, dp: number): number {
  const f = 10 ** clampDp(dp);
  return Math.round(n * f) / f;
}

/** U+2212 MINUS SIGN — typographically correct and what the UI already rendered. */
const MINUS = '−';

/**
 * Formats a number for display. Never emits more than 2 decimal places, and
 * always uses U+2212 rather than an ASCII hyphen so every negative in the app
 * looks the same.
 */
export function fmt(n: number, dp = MAX_DECIMALS): string {
  // Normalise -0 to 0 so a rounded-to-nothing negative doesn't render "−0".
  const rounded = roundTo(n, dp) + 0;
  return rounded.toFixed(clampDp(dp)).replace('-', MINUS);
}

/**
 * Formats a signed delta with an explicit sign, e.g. "−0.42" / "+1.3".
 * Replaces the `${x <= 0 ? '−' : '+'}${Math.abs(x).toFixed(2)}` pattern that
 * was duplicated across five call sites. Uses U+2212 MINUS SIGN, matching what
 * those call sites already rendered.
 */
export function fmtSigned(n: number, dp = MAX_DECIMALS): string {
  const rounded = roundTo(n, dp);
  return `${rounded < 0 ? MINUS : '+'}${fmt(Math.abs(rounded), dp)}`;
}

/** Formats a percentage value (already in percent, not a fraction), e.g. "−0.55%". */
export function fmtPct(n: number, dp = MAX_DECIMALS): string {
  return `${fmt(n, dp)}%`;
}

/** Formats a signed percentage, e.g. "+0.55%". */
export function fmtSignedPct(n: number, dp = MAX_DECIMALS): string {
  return `${fmtSigned(n, dp)}%`;
}
