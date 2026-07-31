# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- `SPEC-V1.1.md` — spec amendment for v1.1, covering day navigation, full macro
  tracking, AM progressive overload, the Program screen, and kg/lbs units. Includes
  the v1.1 prompt pack and acceptance tests 26-50.

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
