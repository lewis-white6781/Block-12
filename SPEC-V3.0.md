# BLOCK 12 — SPEC AMENDMENT v3.0

**Status:** authoritative amendment to `SPEC.md`, `SPEC-V1.1.md` and `SPEC-V2.0.md`.
**Baseline:** v2.1.0 (tag `v2.1.0`).

This file does **not** replace the earlier specs. Where this file conflicts
with any of them, **this file wins**, and the conflicting line is listed in
§1 below so the disagreement is explicit rather than accidental.

Read this file together with `SPEC.md`, `SPEC-V1.1.md` and `SPEC-V2.0.md`
before touching Monday's programming, the analysis engine, day navigation,
number formatting, or the release/update channel.

Unlike v2.0, this amendment is written **before** the work, and §7 is a
real forward-looking prompt pack in the style of `SPEC.md` §11 and
`SPEC-V1.1.md` §4.

---

## 0. Why this amendment exists

Four problems, each of a different nature. Three are bugs the spec never
anticipated; one is a deliberate reversal of a rule `SPEC.md` states
explicitly.

| # | Problem | Nature |
|---|---|---|
| 1 | Monday's main slots 1 and 3 are above the athlete's current level — freestanding handstand balance and band-assisted bent-arm press to handstand are aspirational, not trainable, right now. A session you cannot execute produces no logged data and therefore no progression signal at all. | **spec change** — replaces two prescriptions in `SPEC.md` §5.1 |
| 2 | The Difficulty Index and Exercise Progress Index produce abstract, unitless numbers ("Index 132") that do not tell the athlete whether they are getting stronger. The `1 + 0.2 × effectiveLevel` multiplier silently mixes variant difficulty into what is presented as a performance number, so a variant change looks like progress and a genuine rep PR at an easier variant looks like regression. | **spec change** — replaces `SPEC.md` §6.2–6.5 |
| 3 | Day navigation is frozen and over-clamped. `Today.tsx` captures "today" in `useState` at mount and never resyncs, so an installed PWA left open overnight silently refuses to page forward. Past week 12 the screen replaces itself entirely and no day of the block is reachable. Neither behaviour was intended by any spec. | bug |
| 4 | A deployed build does not reliably reach the installed iPhone PWA, and floats render at full double precision. | bug |

Problems 1 and 2 are direct, acknowledged reversals of explicit rules, so —
matching how `SPEC-V1.1.md` §1 and `SPEC-V2.0.md` §1 handled theirs — every
superseded line is listed below rather than quietly coded around.

---

## 1. Amendments to SPEC.md, SPEC-V1.1.md and SPEC-V2.0.md

| Source | Says | v3.0 replacement | Why |
|---|---|---|---|
| `SPEC.md` §5.1 | Monday main slot 1: "Handstand balance attempts (1 set = 2 attempts)", `metric: 'attempts'`, hold-seconds targets | **Partial ROM wall HSPU**, `metric: 'reps'`, judged on reps and range of motion — see §3 | The prescribed movement is not currently trainable; a rep-and-ROM movement at the same slot trains the same quality and produces real logged data |
| `SPEC.md` §5.1 | Monday main slot 3: "Band-assisted bent-arm press to handstand", `metric: 'reps'`, `ladderId: 'press'` | **Belly-to-wall HSPU negative**, `metric: 'reps'`, `ladderId: 'hspu'`, higher rep targets than slot 1 — see §3 | Same reason; the eccentric is the accessible entry point to the same bent-arm pressing pattern |
| `SPEC.md` §5.1 | Monday is titled "Primary HSPU & bent-arm push" | Unchanged. Both replacements sit squarely inside that title. | — |
| `SPEC.md` §6.2 | "Difficulty Index: `effectiveLevel = variantLevel − 0.6 × assistanceTier + romBonus`" | **Deleted.** Variant and assistance are no longer folded into a number; they become a grouping key instead — bests are compared within `variantId:assistanceTier`, so like is compared with like. See §2. | A multiplier that mixes difficulty into performance makes both unreadable |
| `SPEC.md` §6.3 | "set score = raw × `intensityFactor(effLevel)`, where `intensityFactor = 1 + 0.2 × effLevel`" | **Deleted.** `SetLog.score` becomes the plain comparable value (reps, seconds, or reps × relative load) and is no longer read by any screen. | — |
| `SPEC.md` §6.4 | Exercise Progress Index = `current / baseline × 100`, baseline = best of weeks 1–2 | **Deleted.** Replaced by the plain best plus a three-state trend (`up` / `flat` / `down`) with a ±3 % dead band. See §2. | "Index 132" answers no question the athlete actually has |
| `SPEC.md` §6.5 | Relative load / est. 1RM feed the Progress Index | `relativeLoad` and `est1RMrelative` survive as-is and keep their tests; they now feed the plain weighted-reps comparison directly rather than an index | The maths was never the problem; the index on top of it was |
| `SPEC.md` §6.6 | Stagnation: "recent best < prior best × 1.03" | Unchanged in substance, but now reads its bests from `src/domain/performance.ts` so the stagnation detector and the displayed trend can never disagree | Two implementations of "is this flat?" is one too many |
| `SPEC.md` §7.1 | Today screen shows today | Today shows **any of the block's 84 days**, reachable in both directions and fully editable. "Today" is a live value, not a mount-time snapshot. See §4. | Bug 3 |
| `SPEC.md` §7.3 | Progress screen shows a Difficulty timeline line chart across skills | Replaced by a per-skill "best by week" sparkline in the skill's own unit. Four skills with four different units on one shared Y axis was never meaningful. The heatmap, streak, progression-event list and flag-frequency chart are unchanged. | Same reason as §6.2–6.4 |
| `SPEC.md` §2 | "Service worker for offline app shell" | Still true, but the shell is now **build-stamped and self-updating** with an explicit page-controlled swap. See §5. | Bug 4 |
| `SPEC-V2.0.md` §5, test 60 | Claims "Reset block" is not resurrected by the next background sync | **Corrected: this was never true.** `mergeByKeyLWW` is union-only with no tombstone mechanism, so every remote record merges straight back in on the next pull. Fixed properly in §6 via `settings.resetAt`. | An acceptance test asserting a behaviour the code does not have |

Everything else stands unchanged — in particular every prescription in
`SPEC.md` §5 other than Monday main slots 1 and 3, the stop-rule engine, the
one-variable rule, the tendon guardrails, the autoregulation model, the
cut-corridor model in §6.9, the AM progression model in `SPEC-V1.1.md` §2,
the kg-native rule in `SPEC-V1.1.md` §3, and the whole sync/auth
architecture in `SPEC-V2.0.md` §2.

---

## 2. The plain performance model

Replaces `SPEC.md` §6.2–6.5.

**The question the athlete actually asks** is "am I getting stronger at this
movement?". The honest answer is a number in the movement's own unit, next
to the same number from a few weeks ago. Everything else was ceremony.

`src/domain/performance.ts` — pure, `vitest`-tested, no `any`:

```ts
type BestKind = 'reps' | 'seconds' | 'weightedReps' | 'distance';

interface Best {
  kind: BestKind;
  value: number;      // reps, or seconds, or metres
  addedKg?: number;   // weightedReps only
  romCm?: number;     // when the exercise progresses on ROM
  variantId?: string;
  assistanceTier?: number;
  date: string;
  week: number;
}
```

- `setValue(metric, set)` — the raw logged number for that metric. No multipliers, no factors. For `attempts` it is the **best single attempt**, not the sum: summing rewards taking more attempts, which is not the same as being better at it.
- `compareBests(a, b)` — for **weighted** movements load leads and reps break the tie, so 1 rep at +25 kg beats 8 reps at +20 kg, which is how a weighted movement actually progresses. For everything else the raw value leads. `romCm` breaks a final tie and is the one comparison that **inverts** — lower pad height is deeper is better.
- `bestOf(bests)` / `bestBySession(sessionLogs, exercise)` — reuse the existing `isQualifyingSet` (any technique flag, RPE 10, or no raw value at all disqualifies). That rule is unchanged and keeps its `SPEC-V1.1.md` §2.4 behaviour of excluding v1.0's bare AM completion markers. A session where the exercise was logged but nothing qualified is **omitted** from the history rather than recorded as zero — a session of flagged sets is missing data, not a bad result.
- `bestByVariant(history)` → keyed by `` `${variantId}:${assistanceTier}` ``. **This is how variant difficulty is now handled.** A set at "light band" is never numerically compared against a set at "none"; they are separate rows. Moving between them is already recorded as a `ProgressionEvent`, which is the honest place for that information.
- `trend(history)` → `'up' | 'flat' | 'down'`: best of the last 2 sessions vs best of the 3 before it, with a ±3 % dead band. The 1.03 threshold is the same constant `SPEC.md` §6.6's stagnation rule uses, and both now read it from one place.
- `formatBest(best)` → `"8 reps"`, `"12 s"`, `"6 reps @ +10 kg"`, `"6 reps · 15 cm"`.

**Range of motion becomes a logged number.** `SetLog` gains optional
`romCm?: number` — the height in centimetres of the pad or block stack the
head touches at the bottom of the rep. Lower is deeper is better. This makes
"greater ROM" a measurable axis rather than a free-text `romNote`, without
inventing a scoring formula for it. `romNote` is retained for anything that
is not a height (e.g. "lean 12 cm", "feet on 40 cm box").

The entry field appears only when the exercise's `progressionLadder`
includes `'greater ROM'`, so it does not add a tap to the other ~68
exercises.

`SetLog.score` stays in the type — exports, old rows and the CSV all depend
on it — but becomes the plain comparable value and is read by no screen.

---

## 3. Monday, main block

Replaces `SPEC.md` §5.1's main slots 1 and 3. Slots 2 (`pike-hspu`), 4
(`ring-dip`), 5 (`pike-compression`), the optional second easy run, and the
entire Monday AM block are **untouched**.

### Slot 1 — `wall-hspu-partial`, "Partial ROM wall HSPU"

`metric: 'reps'`, `ladderId: 'hspu'`, `tracked: true`.
The existing `hspu` ladder already expresses ROM as variants
(`wall-hspu-partial` 4 → `wall-hspu-full` 5 → `wall-hspu-deficit` 6), so no
new ladder is invented.

`progressionLadder: ['greater ROM', 'cleaner line', 'more reps at the same RPE']`
`stopRules: ['depth reduced from the first rep', 'elbows flared out of position', 'needed momentum']`
`cues: ['belly to wall, elbows tracking forward', 'lower only as far as the line holds', 'stop the set when depth shrinks']`

| weeks | sets | reps | RPE | note |
|---|---|---|---|---|
| 1–2 | 4 | 3–5 | 7 | |
| 3–5 | 5 | 4–6 | 7.5–8 | |
| 6 | 3 | 3 | 6 | deload |
| 7–9 | 5 | 5–7 | 8 | |
| 10 | 4 | 6–8 | 8–8.5 | |
| 11 | 3 | 4 | 7 | |
| 12 | 3 | — | — | `test reps at the deepest ROM you own` |

### Slot 3 — `belly-wall-hspu-negative`, "Belly-to-wall HSPU negative"

`metric: 'reps'`, `ladderId: 'hspu'`, `tracked: true`.
Deliberately higher rep targets than slot 1 — the eccentric is the
accessible half of the movement, so it carries the volume.

`progressionLadder: ['greater ROM', 'slower lower', 'more reps at the same RPE']`
`stopRules: ['lower became a drop', 'elbows flared out of position', 'depth reduced from the first rep']`
`cues: ['3–5 s lower under control', 'come down or step down — do not press back up']`

| weeks | sets | reps | RPE | note |
|---|---|---|---|---|
| 1–2 | 3 | 5–8 | 7 | |
| 3–5 | 4 | 6–9 | 7.5–8 | |
| 6 | 2 | 5 | 6 | deload |
| 7–9 | 4 | 7–10 | 8 | |
| 10 | 4 | 8–10 | 8–8.5 | |
| 11 | 2 | 6 | 7 | |
| 12 | 2 | — | — | `test reps at the deepest ROM you own` |

The progression mechanism is unchanged: the same stop-rule engine, the same
one-variable rule, the same `ProgressionEvent` logger, the same phase RPE
caps. Only the movement and its metric change.

### Retired exercises

`hs-balance-primary` and `press-to-hs` are removed from Monday but **not
deleted**. `src/data/retiredExercises.ts` holds their `Exercise` records
verbatim, and `lookupExercise(id)` checks `program` then
`retiredExercises`. Historical logs are **never rewritten** — a Monday
already logged under the old programming must still open, name its
exercises correctly, and remain editable. `SessionRunner` additionally
renders any exercise present in a session log but absent from that day's
current prescription, appended after the prescribed ones.

This is a general mechanism, not a one-off: any future programming change
mid-block uses it.

### Acknowledged consequence

After this change Monday's main block is Partial ROM wall HSPU → pike HSPU →
belly-to-wall negatives → ring dips: four consecutive elbow- and
shoulder-loaded pushes. This is a deliberate accepted trade — it is a
strictly easier day than the version it replaces, because the two hardest
and least executable movements are gone — but the existing elbow/shoulder
volume warnings in `src/domain/readiness.ts` are the signal to watch, and
they are expected to fire more often in weeks 3–5 and 7–9. If they fire
persistently, the correction is to cut `pike-hspu` sets, not to add a new
rule. Freestanding handstand balance work leaves the main block entirely;
the `handstandEntry` ladder is still trained and tracked via `toe-pulls`
in Monday's AM block.

---

## 4. Day navigation

Replaces `SPEC.md` §7.1's implicit "the Today screen shows today".

**Model:** the block is 84 consecutive days indexed 0–83 from
`settings.blockStartDate`. The Today screen shows exactly one of them. Every
day is reachable in both directions and every day is fully editable —
backwards to correct something forgotten, forwards to log ahead. Data has
always been saved per-day (`sessionLogs` keyed `${date}:${block}`,
`dailyEntries` keyed by date); this makes that reachable.

- `useToday()` (`src/hooks/useToday.ts`) returns a **live** `Date`, resynced on `visibilitychange` and by a timer armed for the next local midnight. This is the fix for bug 3: `startOfToday()` captured once in `useState` is the root cause of the frozen pager.
- `phase.ts` gains `blockDayIndex(date, blockStart)` → 0–83, `dateForBlockDay(blockStart, i)`, `clampToBlock(date, blockStart)`.
- Navigation bounds become `index > 0` / `index < 83`. The clamp exists in exactly one place — the current duplication between the handlers and the `disabled` props is itself a defect.
- Days after today carry a muted `Upcoming` chip. They are not blocked; nothing in the store ever required a date to be today.
- "Block complete" stops being an early return that replaces the screen. It becomes a banner above the normal day view, so week 12 no longer locks the athlete out of their own 12 weeks of data.
- A 7-dot week strip under the pager marks which days of the displayed week have logged data.
- The Body screen's date input is clamped to the block range rather than to `max = today`.

---

## 5. The release and update channel

Replaces `SPEC.md` §2's one-line service-worker requirement.

**Requirement:** a build pushed to Vercel reaches the installed iPhone
home-screen PWA and the desktop browser without the athlete doing anything,
without losing their place, and without ever interrupting a set.

The current SW cannot do this. `CACHE_VERSION` is the literal string
`'block12-shell-v1'` and the file's bytes never change between deploys, so
the browser detects no SW update, `install` never re-runs, and `activate`'s
cache purge never fires. Non-hashed assets are then cached forever, and a
cold launch on a flaky connection falls back to the cached `index.html`,
whose old hashed asset URLs still hit cache — the app runs the old build
indefinitely with no way out.

1. **Build-stamped worker.** `public/sw.template.js` + `scripts/build-sw.mjs`, run from `npm run build`, substituting `__CACHE_VERSION__` with the build id. The worker's bytes now change every deploy, which is the whole fix.
2. **Page-controlled swap.** The worker drops its unconditional `skipWaiting()` and waits for a `SKIP_WAITING` message. The page decides when. Fetch strategy is otherwise unchanged: navigations network-first with cache fallback, static assets cache-first, cross-origin (Supabase) passed straight through and never cached.
3. **Cache headers.** `vercel.json` gains `Cache-Control: no-cache, must-revalidate` for `/sw.js` and `/index.html`, and `immutable, max-age=31536000` for `/assets/*`.
4. **Detection.** `src/pwa/updates.ts` keeps the registration and calls `reg.update()` on foreground, on `online`, and every 15 minutes; `updatefound` → `installed` sets `updateReady` in `src/pwa/updateStore.ts` (non-persisted zustand, mirroring `src/sync/syncStore.ts`).
5. **Apply rule.** When `updateReady && document.visibilityState === 'visible' && !location.hash.startsWith('#/session/')`: `await runSync()` first so no local write is in flight across the reload, then post `SKIP_WAITING`, then reload on `controllerchange`. Mid-session it waits. Nothing is lost either way — state lives in `localStorage` and Supabase, never in memory only.
6. **Confirmation.** `__APP_VERSION__` and `__BUILD_ID__` are `define`d by Vite. On load, if the stored `lastSeenVersion` differs, a toast reads `Updated to v3.0.0`. Settings' About card shows version, build id, update status, and a "Check for updates" button that applies immediately.

---

## 6. Sync corrections

Amends `SPEC-V2.0.md` §2. The whole-blob transport with per-record
last-write-wins merge is sound and stays. Three defects close:

- **Deletion has no representation.** `mergeByKeyLWW` unions keys, so anything deleted locally is resurrected from the remote side on the next pull. `SPEC-V2.0.md` §5 test 60 asserts the opposite; it was wrong. Fix: `settings.resetAt?: string`, stamped by the block reset. During merge, a **remote** record whose `updatedAt` predates the winning settings' `resetAt` is dropped. This reuses the settings LWW that already exists and needs no new table, no tombstone rows, and no server change.
- **Blind upsert.** `pushRemote` upserts with no concurrency check. Fix: capture `updated_at` at pull; re-read it immediately before push; if it moved, re-run pull → merge once, then push. Data was never truly lost — the loser re-merged within 30 s — but the visible flip-flop goes away.
- **Sync status is invisible outside Settings.** The status pill moves into the `PhaseBadge` top bar so every screen answers "is this device current?". Sync also fires explicitly on session completion and before an update reload.

---

## 7. Data model deltas

Amends `SPEC.md` §4, `SPEC-V1.1.md` §3 and `SPEC-V2.0.md` §3. Additive only.

```ts
export interface SetLog {
  // ...all existing fields unchanged...
  romCm?: number; // NEW — pad/block height at the bottom of the rep, cm. Lower = deeper.
}

export interface Settings {
  // ...all existing fields unchanged...
  resetAt?: string; // NEW — ISO timestamp of the last block reset; the merge tombstone cutoff
}
```

`resetAt` is optional and written only by the block reset, so on a block that
has never been reset it is simply absent — the same treatment
`carbTargetLow`/`fatTargetLow` already get in `defaultSettings()`. The merge
reads absent as "no cutoff".

**Storage.** `STORAGE_KEY` remains `block12:v1`. `SCHEMA_VERSION` goes to
`4` with a real `migrateToV4`, chained after `migrateToV3` — the same
mechanism, not a new one. It runs on rehydration, on JSON import, and on
the sync pull, so remote rows upgrade for free.

`migrateToV4`:
- recomputes every `SetLog.score` to the plain value, stripping the old `1 + 0.2 × effectiveLevel` weighting so old and new rows are comparable;
- leaves every historical `exerciseId` untouched, including `hs-balance-primary` and `press-to-hs`.

**Number formatting.** `src/domain/format.ts` becomes the single rounding
authority: `round2`, `fmt(n, dp = 2)`, `fmtSigned`, `fmtKg`, `fmtPct`.
**Nothing rendered anywhere in the app exceeds 2 decimal places.** The
cut-corridor band in `WeightChart` is the worst current offender — it builds
a raw float, converts units, and hands it unrounded to recharts — but the
rule is global, and `formatWeight` in `units.ts` (currently dead code) is
adopted at every call site rather than each one inlining its own `toFixed`.
This is display only; `SPEC-V1.1.md` §3's kg-native rule for the domain and
for all stored and exported values is untouched.

---

## 8. Prompt pack

One numbered step per commit, conventional-commit message. `npm run build`
**and** `npx vitest run` must both pass before a step is done — `tsc
--noEmit` alone misses errors that `tsc -b`'s project-references mode
catches.

1. **This file.** Write the amendment first so every later step has an authority to cite.
2. **`src/domain/format.ts`** — `round2`, `fmt`, `fmtSigned`, `fmtKg`, `fmtPct`, plus tests asserting no output ever exceeds 2 dp.
3. **The 2 dp sweep** — `WeightChart`'s corridor band first (round the series and the band, add an explicit tooltip formatter), then `Body`, `Review`, `Settings`, `SessionRunner`, `DailyEntryFields`, `Progress`.
4. **Schema v4** — `romCm`, `settings.resetAt`, `migrateToV4`, migration tests.
5. **Retired-exercise registry** — `retiredExercises.ts`, `lookupExercise`, adopted at every `program.find(...)` site; `SessionRunner` renders logged-but-unprescribed exercises.
6. **Monday v3** — the two new exercises in `program.ts`, the old two moved to the registry, the ROM field in `SetLogger`.
7. **`src/domain/performance.ts`** — plain bests, `bestByVariant`, `trend`, `formatBest`, with full test coverage.
8. **Retire the indices** — delete `difficulty.ts` and its tests, strip `scoring.ts`, repoint `Progress`, `ProgressChart`, `Review` and `analysis` onto `performance.ts`.
9. **Day navigation** — `useToday`, the `phase.ts` block-day helpers, the 84-day pager, the week strip, the block-complete banner, the Body date clamp.
10. **Sync corrections** — `resetAt` tombstones in `merge.ts`, pull-recheck-push in `syncEngine.ts`, tests for both.
11. **Sync status in the top bar.**
12. **Build-stamped service worker** — `sw.template.js`, `scripts/build-sw.mjs`, the Vite `define`s, the `vercel.json` headers.
13. **Silent auto-update** — `src/pwa/`, foreground checks, sync-then-swap-then-reload, the "Updated to vX" toast, the Settings version card.
14. **Ship** — `README.md` rewrite, `CHANGELOG.md`, `CLAUDE.md`, `package.json` → `3.0.0`, tag `v3.0.0`.

---

## 9. Acceptance tests

Continuing the numbering in `SPEC-V2.0.md` §5 (which ended at 60). v3.0 is
not done until every line here passes, and every test from `SPEC.md` §10,
`SPEC-V1.1.md` §5 and `SPEC-V2.0.md` §5 still passes too — **except** test
60, which §1 supersedes and test 74 replaces.

**Monday**

61. Monday main slot 1 reads "Partial ROM wall HSPU", 4 sets, 3–5 reps, RPE 7 in week 1, and 5 sets of 5–7 at RPE 8 in week 8.
62. Monday main slot 3 reads "Belly-to-wall HSPU negative" with strictly higher rep targets than slot 1 in every week that prescribes reps for both.
63. Slots 2, 4 and 5 and the whole Monday AM block are byte-identical to v2.1.
64. Logging a set on either new exercise accepts a ROM value in cm, and that value appears in the set's summary line and in the CSV export.
65. The stop-rule banner, the one-variable warning and the progression-event logger all still fire on both new exercises.
66. A Monday session logged before the upgrade still opens, names `hs-balance-primary` and `press-to-hs` correctly, and remains editable; its sets are not rewritten.

**Progress**

67. No screen anywhere displays "Index", a difficulty level, or any unitless score.
68. A skill card shows the plain best in the movement's own unit, a trend arrow, and the same figure from four weeks earlier.
69. A rep PR logged at an easier variant does not display as progress against a harder variant's best — the two are shown as separate rows.
70. The displayed trend and the stagnation warning never disagree about the same exercise.

**Navigation**

71. Every one of the block's 84 days is reachable by paging in both directions, and each is editable; edits to a past day and to a future day both persist and survive a reload.
72. With the app backgrounded across local midnight, refocusing advances the pager without a reload.
73. In week 13 the Today screen still shows days and still pages; "Block complete" is a banner, not a takeover.

**Sync**

74. *(replaces test 60)* Resetting the block on device A, then syncing device B, does **not** resurrect A's deleted sessions on either device.
75. Two devices writing different records inside one sync window both converge with neither record lost.
76. The sync status pill is visible and accurate on every screen, not only in Settings.

**Formatting**

77. No number rendered anywhere in the app — including chart tooltips, the cut-corridor band, and both kg and lbs modes — shows more than 2 decimal places.
78. Weight entry still round-trips losslessly in kg; `SPEC-V1.1.md` §3's kg-native storage rule is unviolated.

**Updates**

79. With the app installed to the iPhone home screen, deploying a new build and then foregrounding the app reloads it into that build with all logged data intact.
80. The same, while inside a running session, does **not** reload until the session is finished.
81. A sync completes before any update reload, so a set logged seconds before the swap is not lost.
82. Launching with the network disabled still cold-starts the app from cache.
83. Settings' About card shows the running version and build id, and "Check for updates" applies a pending update immediately.
84. After an update, a toast confirms the new version exactly once, not on every subsequent launch.
85. A stale local `block12:v1` at schemaVersion 3 migrates cleanly to 4 with every `SetLog.score` recomputed to its plain value, every other set field preserved, and historical exercise ids left untouched.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Monday's four consecutive pushing movements overload elbows or shoulders | Explicitly acknowledged in §3; the existing `readiness.ts` volume warnings are the tripwire, and the documented correction is to cut `pike-hspu` sets rather than add a rule. The day is still strictly easier than the version it replaces. |
| Deleting the Difficulty Index loses information the athlete relied on | It did not exist as information — it was a derived number with no unit. Variant and assistance survive intact as the grouping key and as `ProgressionEvent` records, which is strictly more legible than a multiplier. |
| Retiring exercise IDs breaks historical logs or exports | The registry is additive and historical logs are never rewritten; acceptance test 66 covers it directly, and `lookupExercise` is adopted at every lookup site in one commit rather than piecemeal. |
| `migrateToV4` corrupts a live mid-block dataset | Unit-tested before shipping, matching how `migrateToV2` and `migrateToV3` were validated; export-before-upgrading remains the manual safety net. `STORAGE_KEY` is untouched. |
| Free day navigation lets the athlete log a future session by accident | Accepted and intended — the athlete asked for it. The `Upcoming` chip marks the case, and "tap to jump to today" is always one tap away. |
| The auto-update swap reloads at a bad moment | Gated on visible + not-in-session, and preceded by a forced sync. The worker no longer calls `skipWaiting()` on its own, so the page holds the only trigger. |
| A bad deploy auto-propagates to every device with no manual gate | Real, and the cost of the requirement as stated. Mitigated by `npm run build` + `npx vitest run` gating every commit, and by the fact that `localStorage` and the Supabase row are untouched by a rollback — reverting the deploy restores the previous build with all data intact. |
