# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.1.0] - 2026-07-31

Delivered per the Prompt 1-7 sequence in [SPEC-V1.1.md](./SPEC-V1.1.md) §4,
a formal amendment to SPEC.md recording every place v1.1 deliberately departs
from the original spec (notably: AM sessions are now tracked and scored, not
completion checkboxes).

### Added
- `SPEC-V1.1.md` — the v1.1 spec amendment: supersession table, the AM
  progression model, data-model deltas, the prompt pack, and acceptance
  tests 26-50.
- Day navigation on Today: back/forward across the block (clamped to
  `[blockStartDate, today]`), with a clear "viewing a past day" indicator so a
  missed session can be logged without risk of back-dating one by accident.
- kg/lbs unit toggle (Settings). Display and entry only — the domain and all
  stored/exported data stay kg-native.
- Full macro tracking: carbs and fat alongside protein and calories, with
  calories auto-calculated at 4/4/9 kcal/g unless typed directly (which
  overrides and flags the entry). New Body charts and weekly-table columns,
  a daily-entries CSV export, and a Review nutrition card extension.
- AM progressive overload: all 41 AM exercises are now `tracked: true` and
  score like their metric type (including `timeOnly`, previously always 0),
  feeding the same Progress Index and stagnation engine as Main sessions. A
  curated subset carries a `progressionLadder` drawn from SPEC-V1.1.md's
  overload vocabulary; the rest rely on the existing weekly progression
  variable. Today gained a "Start AM session" entry point with full
  prescriptions (`ExerciseCard`) replacing the old bare checklist.
- The Program screen (SPEC.md §7.5) — a week/day browser with prescriptions,
  the RPE table, stop rules, and the progressive-overload definition. It had
  been a 7-line stub since the initial v1.0 scaffold.
- A searchable, day/block-grouped exercise picker on Progress, replacing a
  flat ~70-entry `<select>`.
- A stagnation card on Today (SPEC.md's own wireframe and Prompt 5's
  instructions called for this in v1.0; it was wired into Review only and
  never actually added to Today until this regression pass caught it).

### Fixed
- `persist.ts`'s `migrate()` was a pass-through stub; it's now a real
  migration that backfills Settings defaults on every rehydration, so new
  fields never arrive `undefined` on old data.
- `isQualifyingSet` now requires an actual raw value, so v1.0's scoreless AM
  checklist markers can't silently become a stagnation baseline now that AM
  is scored.

## [1.0.0] - 2026-07-31

Initial build of the fixed 12-week Block 12 program, delivered per the
Prompt 1-8 sequence in [SPEC.md](./SPEC.md) §11.2.

### Added
- Project scaffold: Vite + React + TypeScript, router, design tokens, domain types.
- 12-week program data transcribed into `src/data/`, with week/phase resolution.
- Zustand store with `localStorage` persistence and the full Session Runner.
- Body and nutrition tracking: rolling averages, corridor status, Body screen.
- Difficulty index, scoring, and analysis engine (stagnation detection, Progress Index).
- Progress and Review screens, mobility benchmarks, week-12 targets.
- Durability and ship features: export/import, CSV, PWA support, acceptance test fixes.
- Dev-only "load demo block" seeding behind a Settings flag, for exercising charts
  and detectors against 6 weeks of plausible data.
