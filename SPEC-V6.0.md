# BLOCK 12 — SPEC AMENDMENT v6.0

**Status:** authoritative amendment to `SPEC.md`, `SPEC-V1.1.md`, `SPEC-V2.0.md`,
`SPEC-V3.0.md`, `SPEC-V4.0.md` and `SPEC-V5.0.md`.
**Baseline:** v5.1.0 (tag `v5.1.0`).
**Source of the training and nutrition content:**
[`cut-to-new-year-training-nutrition.md`](./cut-to-new-year-training-nutrition.md),
kept in the repo as the transcription source. Where this file paraphrases that
document, the document wins.

This file replaces the **training content**, the **periodisation** and the
**nutrition targets** of v5.0, adds **daily tick boxes** and a **weekly
calorie check**, and **wipes the previous block's data**. Sync, auth, storage
key, formatting, navigation, the service worker, the three-slot day, the RPE
scales and the plain performance model are unchanged. Every superseded line is
listed in §1.

---

## 0. Why this amendment exists

The athlete started a new 12-week block — "Cut to New Year" — on Sunday
11 October 2026: an upper / lower / mobility split around two football
sessions a week, with a nutrition table keyed to bodyweight. They asked for the
old block's data to be wiped and the new block to start on that day.

---

## 1. Amendments to the earlier specs

| Source | Says | v6.0 replacement |
|---|---|---|
| `SPEC-V5.0.md` §2 | Push / Pull / Legs / Rest / Push / Pull / Rest, GTG Mon/Wed/Fri, three cardio sessions, two flexibility sessions | **Upper A / Rest / Football / Upper B / Football / Mobility + Core / Lower**, all gym sessions in the `main` slot — see §2 |
| `SPEC-V5.0.md` §2 | GTG and cardio as sessions | **Handstand + mobility (daily) and football (Wed/Fri) are tick boxes** on the day, not sessions — see §2 |
| `SPEC-V5.0.md` §3 | Six phases, one arc, deload at week 6 | **Build 1 (1–2), Build 2 (3–4), Deload (5), Build 3 (6–8), Peak + test (9–10), Christmas (11–12)** — see §3 |
| `SPEC-V5.0.md` §3 | RPE cap 8, 8, 8.5, 8.5, 9, 7, 8, 8.5, 8.5, 9, 9, 8 | **8.5, 8.5, 8.5, 8.5, 7, 9, 9, 9, 10, 10, none, none** |
| `SPEC-V5.0.md` §4 | The v5.0 program content | **Replaced in full** — see §4 |
| `SPEC-V5.0.md` §6 | Flexibility benchmarks weeks 1 and 12 | **None.** `BENCHMARK_WEEKS` is empty; the definitions stay for history |
| `SPEC-V5.0.md` §7 | Cut-specific autoregulation list | **Not part of this plan.** The Program screen shows the plan's own rules |
| `SPEC-V5.0.md` §8 | `SCHEMA_VERSION` 6 (7 after v5.1) | **8.** `migrateToV8` wipes the previous block — see §8 |
| `SPEC-V5.0.md` §9 | Seven end-of-block target groups | **Two**: target weight, and the peak test — see §9 |
| `SPEC.md` 6.9 / body.ts | Cut corridor −0.3 to −0.6 kg/week | **−0.25 to −0.75 kg/week**, the nutrition rules' band |
| `SPEC-V1.1.md` §3, Settings | Protein band 170–190 g; optional carb/fat bands set by hand | **Daily targets from the nutrition table** — see §6. The fields stay on `Settings` for old exports; nothing reads them |
| analysis.ts `checkStopRule` | RPE 10 always warns | **Warns only where the week's cap is below 10** — Peak + test prescribes RPE 9.5–10 |

---

## 2. Weekly structure

| Day | Gym session (`main`) | Tick boxes |
|---|---|---|
| Monday | Upper A (push-led) | Handstand + mobility |
| Tuesday | — (rest) | Handstand + mobility |
| Wednesday | — | Handstand + mobility, **Football** |
| Thursday | Upper B (pull-led, garage) | Handstand + mobility |
| Friday | — | Handstand + mobility, **Football** |
| Saturday | Mobility + Core | Handstand + mobility |
| Sunday | Lower (athletic) | Handstand + mobility |

Tick boxes live on `DailyEntry.checks` (`Record<checkId, boolean>`), defined in
`program.ts` as `dailyChecks`. The handstand / mobility contents are **not
listed** — the athlete asked for a box to tick, and the plan's mobility
rotation is theirs to follow. The readiness check-in still gates `main` only.

## 3. Block structure

| Wk | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Phase | build1 | build1 | build2 | build2 | **deload** | build3 | build3 | build3 | peak | peak | christmas | christmas |
| ★ sets | 3 | 3 | 4 | 4 | 2 | 4 | 4 | 4 | 4–5 | 4–5 | floor | floor |
| RPE | 8–8.5 | 8–8.5 | 8.5 | 8.5 | 6–7 | 8.5–9 | 8.5–9 | 8.5–9 | 9.5–10 | 9.5–10 | — | — |

**Day 1 is Sunday 11 October 2026**, at the athlete's instruction. The plan's
own date column runs Monday 12 October – Sunday 3 January, so every phase
boundary here falls one day earlier than the plan prints (e.g. the deload is
Sun 8 – Sat 14 Nov). The Program screen computes its date column from
`blockStartDate`, so it always shows the dates the app is actually using.

## 4. Program content

All content lives in `src/data/program.ts`, built from three helpers so the
plan's single table cannot drift:

- `star()` — the ★ column for sets and the phase RPE.
- `other()` — "All other exercises: 3 sets (2 in Week 5)". A row that states a
  different count (2 for the stretches, 4 for the L-sit, 3–4 for the jumps)
  replaces the 3; week 5 is 2 regardless. A row that states its own RPE ("@ RPE
  7", "Stretch intensity RPE 6–7.5") keeps it every week.
- Weeks 11–12 run **the floor only**: rows 1–3 on Upper A/B, warm-up + 1, 2, 4
  on Lower, 1–4 on Mobility + Core. Everything else is `sets: 0`.

**Two readings the plan left open** (both noted on the prescription):

1. The ★ column says "Floor only" with no number, and the RPE column says "—".
   The floor uses the plan's only general count, **3 sets**, and leaves RPE
   unset.
2. "4–5" ★ sets takes the high end, 5, with "4–5 sets" in the note (the v5.0
   convention for one-number fields).

Rows: "+" pairs marked superset (and the broad jump + lateral bound pair) are
two exercises sharing the row number and a `supersetId`; "or" rows are one
exercise. The Lower warm-up is an 8-minute `runInterval` block with no RPE.
Rest is 210 s for ★ (3–4 min) and 120 s otherwise.

**Ids.** Twenty-four v5.0 ids carry over as the same movement in the same
role (listed in `retiredV5.ts`'s `V6_CARRIED_IDS`). Ten are new:
`ring-curl-b`, `ring-reverse-fly`, `sun-warmup`, `broad-jump`,
`lateral-bound`, `trap-bar-deadlift`, `hanging-leg-raise-slow`,
`copenhagen-plank`, `pike-compression-lsit`, `pallof-press` (`ring-curl` and
`hanging-leg-raise` were already retired ids). The rest of v5.0 is retired:
`src/data/retiredV5.ts` holds the v5.1.0 `program.ts` verbatim, helpers and
all, and exports everything except the carried ids.

## 5. Mobility

No flexibility benchmarks and no weekly mobility variable — the plan names
neither. Mobility + Core's stretches are on the `stretch` scale at RPE 6–7.5.

## 6. Nutrition

`src/data/nutrition.ts` holds the table verbatim and the rules' numbers.
`src/domain/nutrition.ts` holds the maths:

- **Daily targets** (`dailyTargets`): the row for the 7-day average weight
  (weigh-ins dated in the 7 days ending that day; before any, the last weigh-in;
  before any at all, `settings.startWeightKg`). Below 73.0 kg the bottom row is
  held and flagged. Plus every `Settings.nutritionAdjustments` entry dated on or
  before the day, **through carbs only** (kcal / 4 g).
- **Weekly check** (`nutritionCheck`), shown on Body and, when actionable, on
  Today:
  - weeks 1–2 → `early` (rules 3 and 4 start in week 3);
  - an adjustment in the last 7 days → `settling`;
  - no measurable rate (`weeklyRateKg`) or < 5 calorie-logged days in the 7
    days before today → `needData`;
  - losing < 0.25 kg/week: intake within +100 kcal of target → **`tooSlow`,
    recommend −150 kcal** (rule 3); intake above that → `overTarget`, hit the
    target first;
  - losing > 0.75 kg/week: intake within −100 kcal of target → **`tooFast`,
    recommend +150 kcal "if your lifts are dropping"** (rule 4); intake below
    that → `underTarget`, eat to target first;
  - otherwise `onTrack`.

The ±100 kcal adherence tolerance is the app's reading of rule 5's "roughly"
(`NUTRITION_TUNING`). The athlete applies a recommendation with one tap
(stored, dated) and can undo the last one on Body.

## 7. Stop rules

Unchanged except: RPE 10 warns only when `weekRpeCap(week)` is below 10, and
`weekRpeCap` returns `null` for the Christmas weeks (no prescribed RPE, no cap
rule; RPE 10 still warns).

## 8. Storage — the wipe

`SCHEMA_VERSION` becomes **8**. `migrateToV8`:

- keeps daily entries dated on or after `V6_BLOCK_START` (`2026-10-11`);
- keeps sessions, benchmarks, decisions and the protocol only if written after
  `V6_WIPE_CUTOFF` (a fixed instant before the v6 build could run), and
  progression events dated on or after the block start;
- resets settings to defaults on the new block start, carrying the weight unit,
  target weight and reminder time, and seeding the start weight from the
  previous block's last 7-day average; `updatedAt` is the fixed cutoff.

The cutoff is fixed, not "now", because `migrate()` also runs on every pulled
remote blob. A device still on the v5 build can merge old records back into
the cloud copy (labelled schema 7); the next v6 pull strips exactly the same
records again, deterministically, without touching new-block data. No
`resetAt` tombstone is needed. Importing an older export goes through the same
wipe. The localStorage key and Supabase schema are unchanged.

## 9. End-of-block checklist

Shown in Review from week 10. Two groups in `src/data/targets.ts`: **at target
weight**, and **each ★ exercise's weeks 9–10 best matches or beats its week-1
best** (`compareBests`, so weighted lifts compare load first). The plan states
no other goals, so none are claimed.
