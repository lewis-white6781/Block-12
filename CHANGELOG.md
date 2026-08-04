# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [3.0.0] - 2026-08-04

Monday reprogrammed, the progress maths made readable, day navigation
unlocked, and an update channel that actually reaches the phone. Documented
formally in [SPEC-V3.0.md](./SPEC-V3.0.md) — see its §0/§1 for every
superseded line.

### Changed — training

- **Monday main slot 1** is now **Partial ROM wall HSPU** (reps + range of
  motion, 4×3–5 at RPE 7 in week 1, progressing to 6–8 by week 10), replacing
  freestanding handstand balance attempts.
- **Monday main slot 3** is now **Belly-to-wall HSPU negative** (3×5–8 at
  RPE 7 in week 1), replacing the band-assisted bent-arm press to handstand.
  Rep targets are deliberately higher than slot 1's in every week — the
  eccentric is the accessible half of the movement, so it carries the volume.
- Both were above the athlete's current level, so the slots produced no logged
  data and therefore no progression signal. The progression mechanism is
  unchanged: same stop-rule engine, same one-variable rule, same phase RPE
  caps.
- Slots 2, 4, 5 and the whole Monday AM block are untouched, pinned by test.
- **Range of motion is now a logged number** (`romCm` — pad height at the
  bottom of the rep, lower is deeper), shown only for exercises that progress
  on ROM.
- Note: Monday now runs four consecutive pressing movements. The existing
  elbow/shoulder volume warnings are the tripwire; see SPEC-V3.0.md §3.

### Changed — progress

- **The Difficulty Index and Exercise Progress Index are gone.** Nothing in the
  app displays a unitless number any more. `effectiveLevel`, the
  `1 + 0.2 × effLevel` multiplier and `current/baseline × 100` mixed variant
  difficulty into what was presented as performance, so a variant change looked
  like progress and a genuine rep PR at an easier variant looked like a
  regression.
- Skill cards now show the plain best in the movement's own unit, a trend
  arrow, the same figure four weeks ago, and a breakdown per variant and
  assistance tier — like compared with like, rather than fudged by a
  coefficient.
- The shared "Difficulty timeline" chart is replaced by a per-skill best-by-week
  sparkline. Four skills with four different units on one Y axis could not be
  read.
- Per-exercise chart offers "Best set" and "Total volume" in the real unit;
  "Relative est. 1RM" now only where there is a load to be relative to.

### Changed — navigation

- **Every one of the block's 84 days is reachable and editable**, in both
  directions, past and future. Future days carry an "Upcoming" chip.
- "Block complete" is a banner rather than a screen takeover — week 12 passing
  used to lock you out of your own 12 weeks of data.
- A 7-dot week strip marks which days have logged sets.

### Fixed

- **The day pager froze after midnight.** Screens captured "today" once at
  mount; an installed PWA is rarely reloaded, so the forward bound stayed on
  yesterday and the pager silently refused to advance. `useToday` now resyncs on
  foreground and at the midnight boundary.
- **Deployed updates did not reach the installed PWA.** The service worker's
  cache version was a hardcoded string, so its bytes never changed, no update
  was ever detected, and a cold launch on a flaky connection could run the
  previous build indefinitely. The worker is now build-stamped, checked on
  foreground/reconnect/15-minute timer, and swapped in when safe — never
  mid-session, and always after flushing local writes to Supabase.
- **"Reset block" was undone by the next sync.** The merge unions keys and had
  no way to express deletion, so a second device's stale copy re-added every
  deleted record. Fixed via `settings.resetAt` as a tombstone cutoff.
  (SPEC-V2.0.md acceptance test 60 asserted this already worked; it never did,
  and is now marked superseded in place.)
- **Sets could visibly flip-flop between devices.** The push was a blind upsert
  with no concurrency check. It now re-reads `updated_at` before pushing and
  re-merges once.
- **Long decimals everywhere.** The weight-corridor band was rendering values
  like `76.94642857142858`. Nothing displayed anywhere now exceeds 2 decimal
  places, charts and tooltips included.

### Added

- Sync status on every screen, in the header, tappable to force a sync.
- Version and build id in Settings' About card, plus "Check for updates".
- A one-time "Updated to vX" toast after an update lands.
- A retired-exercise registry, so programming can change mid-block without
  orphaning data already logged under the old programming.

### Data model

- `SCHEMA_VERSION` 4. `STORAGE_KEY` stays `block12:v1`.
- `SetLog.romCm?` and `Settings.resetAt?` added; `migrateToV4` rescores every
  stored set to its plain value. Historical exercise ids are never rewritten.

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
