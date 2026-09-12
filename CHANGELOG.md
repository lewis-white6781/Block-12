# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [5.0.0] - 2026-09-12

The block changed goal again. It is now a **calisthenics-priority cut** — 80 kg
to ~73 kg over twelve weeks with the front lever and HSPU as the primary goals —
on a push / pull / legs split, with cardio kept supportive rather than dominant.
Documented formally in [SPEC-V5.0.md](./SPEC-V5.0.md); the training content is
transcribed from [updatedblock20.md](./updatedblock20.md).

### Changed — training

- **Push / Pull / Legs / Rest / Push / Pull / Rest.** Push A (Mon) leads with
  the deficit pike HSPU, Push B (Fri) with the weighted ring dip; Pull A (Tue)
  is the hard front-lever session, Pull B (Sat) the heavy weighted pull-up with
  easier banded lever work; Legs (Wed) is hack squat, Bulgarian, Nordic, calf
  and tibialis. **Thursday is a rest day** with only Flexibility A in the
  evening — the first day of any block to have no main session.
- **Three cardio sessions replace five to six runs**: a 20–30 min moderate
  continuous session after Push A, 30 s / 90 s HIIT after Push B building to
  eight intervals, and a 45–90 min long low-intensity session on Sunday. All
  three are logged on the run RPE scale and none of them is a race.
- **One arc, one deload.** Re-entry (1–2), accumulation (3–5), deload (6),
  intensification (7–10), realization (11), consolidation (12), replacing
  three four-week waves. Week 6 drops volume 40–50% and is mandatory.
- Every accessory carries the plan's own 12-row table; the ring dip, the
  upper-body accessories and the lower-body accessories each share one table
  the plan itself cross-references, so identical prescriptions cannot drift.
- Flexibility A prescribes loaded movements and static holds on separate set
  tables. Both sessions cap at RPE 7.5 — the plan never needs 8+.
- Grease-the-groove rounds are now 2, 2, 2, 3, 3, 1, 2, 2, 3, 3, 2, 1–2.
- Benchmarks move to weeks **1 and 12**; the week-8 mid-test is gone.

### Changed — app

- Phase badge, chart bands and phase notes rewritten for the six new phases.
- Program's reference sections now carry the plan's two RPE tables, its
  cut-specific autoregulation list, and its definition of progress during a cut.
- End-of-block targets rebuilt from the plan's §12 benchmarks: seven groups, the
  last now **cardio** (30-min moderate session, eight HIIT intervals, 80+ min
  long session — all auto-checked).
- Joint warnings gain the three cardio sessions on the Achilles set, and the
  rear-delt fly and both curls on the shoulder and elbow sets.
- Schema **v6**: every stored session phase is recomputed from its week. No
  `exerciseId` is rewritten; the localStorage key and Supabase schema are
  untouched.

### Removed

- The 24 marathon-block movements that do not carry over (every run, the
  suitcase carry, the split squats and rows of the full-body days, the
  wall-facing negative) moved verbatim into `retiredExercises.ts`, along
  with a frozen copy of v4.0's authoring helpers so the records expand to
  exactly what they prescribed. **Forty-three exercises carry their ids over**,
  many to a different day, so their charts span both blocks.
- `waveForWeek`. Nothing in the plan is a wave.

## [4.0.0] - 2026-08-27

The block changed goal. It now trains for a marathon while holding onto the
calisthenics, which reorganises everything around running. Documented formally
in [SPEC-V4.0.md](./SPEC-V4.0.md); the training content is transcribed from
[12_week_hybrid_marathon_calisthenics_plan.md](./12_week_hybrid_marathon_calisthenics_plan.md).

### Changed — training

- **Five to six runs a week**, replacing one Sunday run and one sprint session:
  a Tuesday threshold session (8-minute reps, 3 building to 5), a Wednesday
  recovery run, easy runs Thursday and Saturday, and a long run that builds to
  **eleven 15-minute blocks — 165 minutes — in week 11**. Cap the longest run at
  30–32 km even where the time prescription would take you farther.
- **Three full-body days** (Mon/Wed/Fri) replace the five body-part days.
  Monday is HSPU and heavy dip, Wednesday is front lever, heavy pull and the
  main lower-body work, Friday is mixed calisthenics and physique.
- **Daily mobility is gone.** Mornings are now grease-the-groove skill practice
  on Mon/Wed/Fri only — handstand, front lever, and a mixed round — prescribed
  in **rounds** of the whole list at RPE 4–5. Motor learning, not fatigue.
- **Two flexibility sessions**: Tuesday evening (pancake, middle split,
  handstand shoulders) and Sunday evening (front split, pike, bridge), each with
  six fixed items and its own weekly volume. Sunday is deliberately the lighter
  of the two — it must not become a second leg session after the long run.
- **Periodisation is three four-week waves**, deloading at weeks 4, 8 and 12
  instead of a single arc deloading at week 6. Week 7 is the highest gym loading
  of the block; week 11 peaks the long run and steps gym volume back to pay for
  it; week 12 reduces fatigue rather than testing.
- Lower-body volume falls deliberately through the block as mileage rises.
- The exercises are fixed across the block. Reps and hold durations do not
  change; sets, RPE, running volume and flexibility volume do.

### Added

- **A third session slot per day, `later`.** Wednesday runs a morning GTG block,
  a full-body lift *and* an evening recovery run — the two-slot model could not
  express it. Today, Program and Review all show three.
- **Runs are logged properly.** A new `runInterval` metric captures minutes, RPE
  and an optional distance per prescribed block, with minutes prefilled from the
  prescription. `SetLog.minutes` is its own field; the old `distanceTime` metric
  stored minutes in `reps`, which made run data indistinguishable from rep data
  everywhere downstream.
- **Three RPE scales** (`strength` 6–10, `stretch` 5–8, `run` 1–10), so the
  stepper matches the table the exercise is actually read against. An easy run at
  RPE 2 was previously unloggable — the stepper's floor was 6.
- **Holds now capture RPE**, which is how the entire flexibility prescription is
  stated. Before this, a stretch session logged as bare seconds.
- A `carry` metric for the suitcase carry: 30 m per side, progressed by load.
- **Achilles irritation** joins the readiness check-in, and joint-volume warnings
  now cover three joints. The days each one fires on are derived from the program
  rather than hardcoded, which is what had silently gone wrong when the split moved.
- Six flexibility benchmarks, one per progression chain, measured in weeks 1, 8
  and 12. The mid-block test moved off week 6, which is now an overload week —
  measuring end-range flexibility there tests fatigue.
- Render smoke tests for Today, Program and SessionRunner.

### Changed — app

- The RPE ceiling is `weekRpeCap(week)`, read off the plan's own weekly tables,
  replacing `phaseRpeCap(phase, exerciseId)`. There is no test week to exempt.
- The stop rule's 15% quality-drop check is now measured **within the session**
  against its own first working set, per the plan's Performance Drop Rule.
- Program gained the plan's three RPE tables, its autoregulation rules and its
  joint/tendon rule.
- Schema **v5**: session phases are recomputed from their week (the old names
  describe a periodisation that no longer exists) and old readiness check-ins
  default `achillesIrritation` to 0. No `exerciseId` is rewritten. The sets CSV
  gains a `minutes` column. The localStorage key and Supabase schema are untouched.

### Removed

- **The optional second run and its four-condition gate.** Running is prescribed
  now, not earned; the gate keyed off a sprint session that no longer exists.
- The 66 movements of the pre-v4 block, moved verbatim into
  `retiredExercises.ts`. Nothing is deleted and every historical log still
  resolves its exercise name in Progress, Review and the CSV export.
  `ring-dip`, `ring-pullup` and `fl-raise` carry over with their ids intact —
  same movement, same role — so their charts span both blocks.

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
