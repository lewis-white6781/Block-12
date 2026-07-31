# BLOCK 12 — SPEC AMENDMENT v1.1

**Status:** authoritative amendment to `SPEC.md`.
**Baseline:** v1.0.0 (tag `v1.0.0`), the complete Prompt 1–8 build.

This file does **not** replace `SPEC.md`. `SPEC.md` remains the spec of record for
everything it describes. Where this file and `SPEC.md` conflict, **this file wins**,
and the conflicting `SPEC.md` line is listed in §1 below so the disagreement is
explicit rather than accidental.

Read this file together with `SPEC.md` before writing v1.1 code.

---

## 0. Why this amendment exists

v1.0 was built faithfully from `SPEC.md` and works. Using it for real surfaced five
gaps. Three of them are **not bugs** — they are places where the spec itself is the
limitation:

| # | Problem | Nature |
|---|---|---|
| 1 | Only the current day can be logged; a missed session is unrecoverable | spec silent, code assumed "today" |
| 2 | Nutrition tracks protein + kcal only, not carbs and fat | **spec change** (§4 `DailyEntry`) |
| 3 | AM sessions are completion checkboxes, so morning work never progresses | **spec change** (§4, §5, §7.1) |
| 4 | The Program screen renders blank | **genuine bug** — never implemented |
| 5 | Weights are kg-only; the exercise picker is a flat unsorted list | spec silent / **spec change** (§4 `units`) |

Without writing the changes down, a future session re-reads `SPEC.md`, sees
`tracked: false`, and "corrects" the AM work back into checkboxes. Hence this file.

Item 4 deserves naming precisely: `src/screens/Program.tsx` is a seven-line scaffold
stub whose own first line reads *"Implemented in a later prompt."* Its route, its tab,
and its data are all correct and present. The screen was simply never built. It is the
only item in this list that is purely a defect.

---

## 1. Amendments to SPEC.md

| SPEC.md | Says | v1.1 replacement | Why |
|---|---|---|---|
| `:159` | `tracked: boolean; // false => AM mobility items: completion checkbox only` | All AM items are `tracked: true`. `tracked` now distinguishes *scored* work from *unscored*, not AM from main. | AM work must progress. See §2. |
| `:221-228` | `DailyEntry` has `calories`, `proteinG` | Adds `carbsG?`, `fatG?`, `caloriesOverridden?` | A cut is managed on all four macros, not two. |
| `:251` | `units: 'metric'` | Adds `weightUnit: 'kg' \| 'lbs'`. `units` is retained and ignored. | User needs lbs. |
| `:267` | Monday AM `(RPE 5–6, tracked: false except toe pulls)` | Prescriptions unchanged; `tracked: true` throughout. The RPE 5–6 guidance is retained as the AM target band. | See §2. |
| `:338` | Thursday `ring-assisted pistol squat … (technical practice only, tracked: false)` | `tracked: true`; "technical practice only" is retained as a cue. | See §2. |
| `:590` | Today wireframe: `AM · … 6/6 ✓ ← tappable checklist, collapses when done` | AM renders as a startable session with `ExerciseCard`s and a **Start AM session** button, matching the Main block. The completed-count summary is kept. | See §2. |
| `:811` | Prompt 2 asserts *"30 tracked exercises"* | The correct v1.0 figure is **29** (careful transcription of §5 yields 29, recorded at `phase.test.ts:92-97`). Under v1.1 the tracked count becomes **all 68 program entries** (41 AM + 27 main). | Resolves a discrepancy carried since Prompt 2. |

Everything else in `SPEC.md` stands unchanged — in particular §5's prescriptions,
which are **not** touched by this amendment (see §2.1).

---

## 2. The AM progression model

### 2.1 The constraint that shapes it

`CLAUDE.md` states: *"Never invent training prescriptions, exercise names, or RPE
targets. Copy SPEC.md exactly."* `SPEC.md:260` states: *"Do not invent, round, or
'improve' any prescription."*

`SPEC.md` gives every AM exercise **exactly one flat prescription** covering
`weeks: [1..12]` — e.g. *"passive ring hang 2×30–40 s"*. There is **no week-by-week AM
table, no per-phase AM RPE target, and no AM progression ladder anywhere in the
document.**

Therefore v1.1 **must not** author twelve weeks of AM programming. Doing so would
invent roughly 41 × 12 prescriptions and would be exactly the kind of drift the rule
above exists to prevent.

### 2.2 The model

> **AM progression is driven by logged performance against a constant prescribed
> baseline, not by a periodised prescription.**

The SPEC-written prescription stays as the **target floor** for all twelve weeks.
What changes in v1.1 is that you log what you *actually did*, and the existing
analysis engine — unchanged — reports whether it is going up.

The progression *axis* comes from two mechanisms `SPEC.md` already defines:

**a. The weekly progression variable (`SPEC.md` §5.9, `src/data/mobility.ts:60-73`).**
Already implemented, currently rendered only in Review. One axis per week:

```
W1 establish baseline          W7  resume from improved baseline
W2 add 1–2 reps or 5 s         W8  add active repetitions
W3 increase ROM slightly       W9  increase ROM
W4 add 2–3 s end-range pauses  W10 increase leverage or load
W5 add small load or leverage  W11 reduce volume 30–40%
W6 half volume, re-test        W12 final testing
```

Its own source comment is normative: *"Exactly one shown per week; a second axis is
blocked from logging."* This is the one-variable rule (`SPEC.md` §6.10) applied to
mobility, and v1.1 surfaces it on the Today AM card, not just in Review.

**b. The progressive-overload vocabulary (`SPEC.md:658`, §7.5).** Where an AM exercise
needs a per-exercise `progressionLadder`, its axes are drawn **only** from this list:

> losing assistance · increasing ROM · improving line · harder lever · same reps at
> lower bodyweight · more work at the same RPE · less band · less technique variability

`doNotProgressConditions` (`mobility.ts:76-81`) gates all of the above and is rendered
alongside it: *spine compensates excessively · joint feels pinched · active control
disappears · soreness affects the main strength session.*

### 2.3 What this requires of the code

Three blockers make AM structurally invisible today. All three are engine-level, not
content-level:

1. **`scoring.ts:19-21` returns a hard `0` for `metric: 'timeOnly'`.** 22 of 41 AM
   items are `timeOnly`, so they cannot contribute to set score, session load, or
   Progress Index. `timeOnly` must get a real seconds-based score consistent with
   `hold`. *Prefer this over reclassifying AM items to `hold`* — reclassifying edits
   transcribed §5 data, which this amendment does not authorise.
2. **All 41 AM items have `progressionLadder: []`.** `detectStagnation` and
   `nextProgressionAxis` walk that array in order, so they can never fire for AM.
   Populate from §2.2b.
3. **Nothing navigates to an AM session.** `SessionRunner` already accepts
   `block: 'am'` and filters correctly; `Today.tsx` has simply never had a start
   button for it.

### 2.4 Backward compatibility

`toggleAmChecklistItem` (`useStore.ts:97-124`) writes a **scoreless empty set**
(`sets: [{ id, techniqueFlags: [], score: 0 }]` — no reps, no seconds, no RPE). Any
v1.0 block contains these. They must be treated as **non-qualifying** by
`isQualifyingSet` so they cannot depress a baseline or trigger a false stagnation.
They are completion records, not performance records.

---

## 3. Data model deltas

Amends `SPEC.md` §4. Additive only; every new field on existing interfaces is optional
except `Settings.weightUnit`, which is supplied by migration.

```ts
export interface DailyEntry {
  date: string;
  weightKg?: number;
  calories?: number;
  proteinG?: number;
  carbsG?: number;              // NEW
  fatG?: number;                // NEW
  caloriesOverridden?: boolean; // NEW — true when kcal was typed, not derived
  steps?: number;
  note?: string;
}

export interface Settings {
  blockStartDate: string;
  startWeightKg: number;        // stays kg-native regardless of display unit
  targetWeightKg: number;
  proteinTargetLow: number;
  proteinTargetHigh: number;
  carbTargetLow?: number;       // NEW
  carbTargetHigh?: number;      // NEW
  fatTargetLow?: number;        // NEW
  fatTargetHigh?: number;       // NEW
  units: 'metric';              // retained, ignored
  weightUnit: 'kg' | 'lbs';     // NEW — display/entry only
  reminderTime?: string;
}
```

**Calories from macros.** `caloriesFromMacros(proteinG, carbsG, fatG) = 4p + 4c + 9f`,
a pure function in `src/domain/`. It auto-fills the kcal field as macros are entered.
Typing kcal directly sets `caloriesOverridden = true` and the typed value wins from
then on; the UI shows a hint when an overridden value disagrees with the macro sum.

**Units are a display concern only.** The entire domain layer stays kg-native —
`weightKg`, `addedKg`, `weeklyRateKg`, and the corridor thresholds
(`CORRIDOR_TOO_SLOW_KG` / `CORRIDOR_TOO_FAST_KG`) are unchanged. Conversion happens at
render and at input parse, nowhere else. **Stored and exported data is always kg.**

Two consequences worth stating, because both are easy to break:
- `targets.ts:14` holds the literal string `'72–73 kg'`, string-matched at
  `review.ts:322-325`. A unit toggle must not break that match.
- CSV export stays kg, with the unit named in the header.

**Storage.** `STORAGE_KEY` remains `block12:v1` — it must not change, or every existing
block is orphaned. `SCHEMA_VERSION` goes to `2` with a real `migrate()`. Note that
zustand's `persist` merges **shallowly**: a persisted v1.0 `settings` object replaces
the defaults wholesale, so `weightUnit` would arrive `undefined` at runtime despite its
type. Migration must spread defaults beneath persisted values. The same function guards
the import path, so a v1.0 export must import cleanly into v1.1.

---

## 4. Prompt pack

Run in order, one per step. Check the acceptance line before moving on. Per
`CLAUDE.md`, run `npx tsc --noEmit` and `npx vitest run` before calling a step done,
and commit each step with a conventional-commit message.

**Prompt 1 — foundations**
> Read SPEC-V1.1.md §3. Do not add user-visible features in this step. Bump `SCHEMA_VERSION` to 2 and replace the `migrate()` pass-through in `src/store/persist.ts` with a real version-by-version migration that spreads defaults beneath persisted values — remember zustand merges shallowly, so a v1.0 `settings` blob will otherwise leave new fields undefined. Write the first tests for `persist.ts`: v1→v2 migration fills defaults, export/import round-trips losslessly, malformed input is rejected, and a v1.0 export file imports into the v1.1 app. Then add `src/domain/clock.ts` (`todayISO`, `startOfToday`) and route all fourteen direct clock reads through it — including `review.ts:319`, which is a domain function reading the clock and must instead take an `asOfDate` parameter. Finally extract `exercisesFor(dayId, block, week)` into `src/domain/phase.ts` and use it in both `Today.tsx` and `SessionRunner.tsx`, which hand-roll the same pipeline today. Acceptance: typecheck and tests clean, a v1.0 export imports without loss, and no screen calls `new Date()` directly.

**Prompt 2 — build the Program screen**
> Read SPEC.md §7.5 and Appendices A and B. `src/screens/Program.tsx` is a seven-line stub and renders blank — build it. Read-only browser of the whole block: week selector 1–12 → day → exercises with every prescription and cue. Include the RPE reference table, the universal stop rules, the phase descriptions, and the progressive-overload definition from SPEC.md:658 verbatim. Reuse `resolvePrescription` from `phase.ts`, `formatPrescription` already exported from `ExerciseCard.tsx`, `dayTitles` from `program.ts`, and `PhaseBadge`. Do not hardcode any prescription in JSX. Also add a `*` catch-all route in `App.tsx` — there is none, so any unknown hash currently renders an empty shell. Acceptance: all 12 weeks × 7 days browse correctly; hand-check five random week/day combinations against SPEC.md §5.

**Prompt 3 — day navigation**
> Read SPEC-V1.1.md §1. On the Today screen, add a selected-date state with back/forward arrows and a "Today" reset, clamped to `[blockStartDate, today]` — any past day is freely loggable, forward navigation stops at today. Make it visually obvious when a past day is being viewed so a session is never back-dated by accident. The store needs no changes: every action already takes an explicit date and `sessionLogs` are keyed `${date}:${block}`. The one real trap: `useStore.ts:48-58` snapshots `week` and `phase` onto the log at creation, so a session created for a past date must compute week and phase from *that* date, not from today. Acceptance: navigate back three days, log a full session, and confirm it lands in the correct week in Review and on the Progress heatmap.

**Prompt 4 — units**
> Read SPEC-V1.1.md §3. Add `Settings.weightUnit` and a segmented kg/lbs control in Settings. Create `src/domain/units.ts` with `kgToLbs`, `lbsToKg`, `formatWeight(kg, unit)` and `parseWeight(input, unit)`, tested for round-trip stability — entering 165 lbs must still read 165 lbs, not 164.9. The domain stays kg-native: do not touch `scoring.ts`, the `body.ts` corridor thresholds, or any stored value. Convert only at display and entry edges, replacing the hardcoded "kg" strings in `DailyEntryFields`, `Body`, `Review`, `WeightChart`, `Settings` and `SessionRunner`. Do not break the `'72–73 kg'` string match between `targets.ts:14` and `review.ts:322-325`. Keep CSV export in kg and name the unit in the header. Acceptance: toggling to lbs converts every weight on every screen, stored JSON is byte-identical, and corridor status is unchanged.

**Prompt 5 — full macros**
> Read SPEC-V1.1.md §3. Add `carbsG`, `fatG` and `caloriesOverridden` to `DailyEntry`, and carb/fat target ranges to Settings. In `body.ts`, widen the `rollingMean` field union, add `rolling7Carbs` and `rolling7Fat`, and extend `WeeklySummary` and `weeklySummaries`. Add pure `caloriesFromMacros(p, c, f)` = 4p + 4c + 9f: it auto-fills kcal as macros are typed, a directly typed kcal sets the override flag and wins, and the UI hints when an overridden value disagrees with the macro sum. `DailyEntryFields` is currently a single flex row of three fields — five will not fit at 380px, so convert it to a grid. Extend the Body charts and weekly table, the Review nutrition card, and `demoSeed.ts` so the demo block still populates every chart. `body.test.ts`'s `entry()` helper takes positional args and is used about fifteen times — convert it to an options object rather than adding two more positions. Add a daily-entries CSV export; only sets have one today. Acceptance: log all four macros, watch kcal auto-fill, override it, and confirm the override persists and charts populate.

**Prompt 6 — AM progressive overload**
> Read SPEC-V1.1.md §2 in full before touching anything. Set `tracked: true` on all 41 AM entries in `program.ts`, leaving every prescription byte-for-byte as transcribed — only the flag changes. Give `metric: 'timeOnly'` a real seconds-based score in `scoring.ts` consistent with `hold`; do not reclassify AM items to `hold`, because that would edit transcribed SPEC data. Populate `progressionLadder` for AM exercises using only the vocabulary in SPEC-V1.1.md §2.2b — invent no axes. Add a "Start AM session" button on Today and replace the bare checklist markup with `ExerciseCard` so AM prescriptions are visible at all; they currently show the exercise name and nothing else. `SessionRunner` already handles `block: 'am'` correctly, so this is an entry-point change, not a Runner rewrite. Add a `timeOnly` branch to `SetLogger` routing to `HoldTimer`. Widen the `block === 'main' && e.tracked` filters in `Progress.tsx:63` and `review.ts:183` to include AM, adding an AM/Main filter so the picker stays usable. Surface the §5.9 weekly progression variable and `doNotProgressConditions` on the Today AM card. Treat v1.0's scoreless checklist sets as non-qualifying in `isQualifyingSet` so they cannot corrupt baselines. `phase.test.ts:86-98` asserts a tracked count of 29 and will fail by design — update it deliberately and reconcile it with the note in SPEC-V1.1.md §1. Acceptance: run a full AM session through the Runner logging real reps, seconds and RPE; it scores, appears on Progress, counts in Review, and stagnation fires on flat AM data.

**Prompt 7 — exercise library, regression, ship**
> The exercise picker at `Progress.tsx:206-219` is a flat, unsorted, ungrouped native `select` in raw array order; after Prompt 6 it holds about seventy entries. Replace it with a searchable, grouped picker built on the existing `Sheet` component. Group using data that already exists — `dayTitles`, `block`, `ladderId`, `metric` — rather than inventing a muscle-group taxonomy; if a `pattern` field proves genuinely necessary, add it as metadata, not as a prescription, and record it in SPEC-V1.1.md §3. Then work through SPEC.md §10's 25 acceptance tests plus SPEC-V1.1.md §5, fix what fails, and report as a checklist without marking anything passing you have not actually exercised. Finish by bumping the version to 1.1.0, updating CHANGELOG.md, and tagging v1.1.0.

---

## 5. Acceptance tests

Continuing the numbering in `SPEC.md` §10. Run these by hand. v1.1 is not done until
every line passes, and `SPEC.md` §10's original 25 must still pass too.

26. From Today, arrow back three days; the header shows that day's week, phase and day title, not today's.
27. Log a complete main session on a back-dated day; it appears in Review under the correct week.
28. Forward navigation is disabled on today. No future day can be started.
29. Navigating back before `blockStartDate` is not possible.
30. The Program screen renders. Week 7 → Friday lists all five main exercises with correct prescriptions.
31. Program shows the RPE table, the stop rules, and the progressive-overload definition.
32. An unknown URL hash renders a 404, not a blank shell.
33. Switching to lbs converts every weight on Today, Body, Progress, Review, Runner and Settings.
34. After switching to lbs, exported JSON still contains kg values.
35. Corridor status and weekly rate are identical in kg and in lbs.
36. Entering protein, carbs and fat auto-fills kcal at 4/4/9.
37. Typing kcal directly overrides the calculation, persists, and shows the mismatch hint.
38. The Body screen charts all four macros; the weekly table shows all four means.
39. Daily entries export to CSV.
40. An AM session starts from Today and runs in the Session Runner.
41. AM exercises show their full prescription, not just a name.
42. A logged AM hold records seconds via the HoldTimer and produces a non-zero score.
43. AM exercises are selectable on Progress and chart correctly.
44. Review counts AM sessions toward "5 main + 7 AM".
45. The weekly progression variable for the current week shows on the Today AM card.
46. Stagnation fires on three flat AM sessions and names an axis from §2.2b.
47. v1.0 checklist-only AM records do not corrupt any baseline or fire a false stagnation.
48. The exercise picker is searchable and grouped, and remains usable at ~70 entries.
49. **A v1.0.0 JSON export imports into v1.1 with no data loss.** (Highest-risk regression.)
50. The whole app still works one-handed at 380px, offline, with tap targets ≥ 44px.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| AM tracking floods Progress and Review with low-signal mobility data | AM/Main filter on Progress; `timeOnly` scoring kept separate from strength scoring; stretches carry no ladder, so stagnation stays quiet for them |
| Migration corrupts a live block mid-flight | `migrate()` is tested before any feature ships (Prompt 1); `STORAGE_KEY` is never changed; export before upgrading |
| Unit conversion drift makes weights wander | Domain stays kg-native; conversion only at edges; round-trip stability is a unit test |
| Scoring `timeOnly` distorts existing Progress Indexes | It only ever scored `0`, so no existing chart depends on the old value; verify against the demo block before and after |
| Scope creep across seven prompts | Each prompt ends in a commit and an acceptance line; the block stays usable at every step |
