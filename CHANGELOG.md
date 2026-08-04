# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [2.1.0] - 2026-08-03

Multi-device cloud sync plus a UI-consistency pass, shipped together.
Sync/auth/deploy is documented formally in
[SPEC-V2.0.md](./SPEC-V2.0.md), a spec amendment reversing SPEC.md's
original "no backend, no auth" decision — see its §0/§1 for why.

### Added
- **Multi-device sync via Supabase** (Postgres + Auth). Sign in with an
  email one-time code (in practice, tap the link in the email — see
  SPEC-V2.0.md §4 for why a typed code isn't currently shown), and the
  same account's training data syncs across every device you sign into.
  Periodic + event-triggered sync (~30s interval, on app foreground, on
  reconnect, on local write, or manual "Sync now") — no realtime
  subscriptions. Offline-first behavior is unchanged: localStorage remains
  the source of truth, sync is a background mirror that never blocks a
  local read or write.
- New "Sync" section in Settings: signed-in-as email, sync status
  (syncing/synced Xm ago/offline/error), manual "Sync now", sign-out.
- `src/sync/merge.ts` — pure last-write-wins merge per entity, unit-tested
  independently of Supabase/React/zustand.
- Deployed to Vercel with a permanent URL, auto-deploying on every push to
  `master`.
- **"Reset block — start over today"**: the existing danger-zone reset
  (which already restarted the block from the current week's Monday) now
  says so explicitly, fixes a stale-state bug where an already-open
  Today/Review screen could keep showing the pre-reset day or week, and
  pushes the reset to your synced account immediately instead of waiting
  for the next background sync.
- Shared `Card`, `SectionHeader`, and `PagerNav` components, replacing
  dozens of copy-pasted card/label/pager markup blocks across every
  screen with one consistent, spec-compliant implementation of each.

### Changed
- The persistent 12-segment block bar (`PhaseBadge`, SPEC.md §8's
  "signature element," required on "every screen") now actually appears
  on every primary screen — it previously rendered only on Today and
  Program.
- Section labels across Today, Body, Progress, and Program now use the
  same small/uppercase/muted convention SPEC.md §8 specifies and Settings
  already used, instead of each screen rolling its own plain-text label.
- Today's "viewing a past day — tap to jump to today" pill no longer uses
  the warning color, so it doesn't visually compete with genuine
  physiological warnings on the same screen.
- Review's eight hand-rolled "label + big number" blocks now use the
  existing `Stat` component, fixing both the duplication and a silent
  `text-2xl` vs `text-3xl` sizing mismatch with Body's identical stats.
- Progress's "No matches." empty state now reads "No exercises match —
  try a different search," matching SPEC.md §8's own instructive-copy
  example.

### Data model
- `SCHEMA_VERSION` 2 → 3. `SessionLog`, `DailyEntry`, `BenchmarkEntry`,
  and `Settings` gain an `updatedAt` timestamp, backfilled on migration.
  `benchmarkEntries` changes from an array to a `Record<string,
  BenchmarkEntry>` keyed by week. See SPEC-V2.0.md §3.

## [1.1.2] - 2026-07-31

### Fixed
- **Log Set button silently did nothing past the first tap on any exercise
  when the app was loaded in an insecure context** (plain `http://` on a LAN
  IP, some webview/PWA installs) — `crypto.randomUUID()` throws there rather
  than returning a value, since it's gated to secure contexts. Every call
  site that built a new set/progression-event id (`SessionRunner`'s
  `logCurrentSet`, `useStore`'s `toggleAmChecklistItem`, `ProgressionLogger`)
  called it directly, so the click handler threw before `logSet()` ever ran —
  no error surfaced in the UI, the set count never advanced, and the only way
  forward looked like skipping to the next exercise. Replaced every call with
  `domain/id.ts`'s `newId()`, which prefers `crypto.randomUUID()` but falls
  back to `crypto.getRandomValues()` (unrestricted in all contexts) and then
  `Math.random()`.

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
