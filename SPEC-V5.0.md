# BLOCK 12 — SPEC AMENDMENT v5.0

**Status:** authoritative amendment to `SPEC.md`, `SPEC-V1.1.md`, `SPEC-V2.0.md`,
`SPEC-V3.0.md` and `SPEC-V4.0.md`.
**Baseline:** v4.0.0 (tag `v4.0.0`).
**Source of the training content:** [`updatedblock20.md`](./updatedblock20.md),
kept in the repo as the transcription source. Where this file paraphrases that
document, the document wins.

This file replaces the **training content** and the **periodisation** of v4.0
completely, and leaves the app's architecture — sync, auth, storage, formatting,
navigation, the service worker, the three-slot day, the three RPE scales, the
plain performance model — standing. Every superseded line is listed in §1.

---

## 0. Why this amendment exists

The block changed goal again. v4.0 trained for a marathon while holding onto the
calisthenics. v5.0 is a **calisthenics-priority cut**: 80 kg → ~73 kg over
twelve weeks, with the front lever and handstand push-up as the primary goals,
weighted strength retained, and cardio kept deliberately supportive rather than
dominant.

Unlike v4.0, this is largely a content change. The v4.0 data model — three
blocks per day, `runInterval`, three RPE scales, `sets: 0`, GTG rounds — carries
every shape this plan has. Three things about the plan's *structure* still
needed a decision rather than a transcription:

| # | Problem | Nature |
|---|---|---|
| 1 | Thursday is a **rest day** with only an evening stretch. v4.0's tests and one comment assumed every day has a `main` session. | **spec change** — a day may prescribe only `later` |
| 2 | Periodisation is **one arc** with a single deload at week 6, in six named phases. The v4.0 `Phase` union describes three waves. | **spec change** — replaces SPEC-V4.0.md §3 |
| 3 | Flexibility A prescribes **two set counts per week** — one for its loaded movements and one for its static holds — against a single RPE. v4.0 had one table per session. | **content** — two tables, same builder |

---

## 1. Amendments to the earlier specs

| Source | Says | v5.0 replacement | Why |
|---|---|---|---|
| `SPEC-V4.0.md` §2 | Mon/Wed/Fri full-body, five to six runs, flexibility Tue/Sun | **Push / Pull / Legs / Rest / Push / Pull / Rest** — see §2 | The block's goal changed |
| `SPEC-V4.0.md` §2 | "Every day of the block has at least a main session" | **Thursday has none.** A day may prescribe only a `later` slot | Thursday is a rest day with Flexibility A in the evening |
| `SPEC-V4.0.md` §3 | Three four-week waves; `Phase` = baseline / reinforce / overload / deload / rebuild / peak / marathonPeak / taper | **Six phases, one arc**: reentry (1–2), accumulation (3–5), deload (6), intensification (7–10), realization (11), consolidation (12) — see §3 | Deloads move from 4/8/12 to 6 alone |
| `SPEC-V4.0.md` §3 | `waveForWeek` | **Deleted.** Nothing in the plan is a wave | — |
| `SPEC-V4.0.md` §3 | RPE cap 8, 8.5, 9, 7, 8.5, 9, 9, 7, 8.5, 9, 8.5, 7.5 | **8, 8, 8.5, 8.5, 9, 7, 8, 8.5, 8.5, 9, 9, 8** — see §3 | Read off the new tables |
| `SPEC-V4.0.md` §4 | The v4.0 program content | **Replaced in full** — see §4 | — |
| `SPEC-V4.0.md` §4 | Long run as two exercises (base + finish) with `sets: 0` opt-outs | **One continuous session** per cardio slot, `sets: 1`, duration in `minutesEach`. Nothing in v5.0 uses `sets: 0`; the mechanism stays | The plan prescribes a duration, not blocks |
| `SPEC-V4.0.md` §4 | Carried-over ids: `ring-dip`, `ring-pullup`, `fl-raise` | **Forty-three ids carry over** — see §4. Twenty-four v4 movements move to `retiredExercises.ts` | Same movements, same roles, different days |
| `SPEC-V4.0.md` §5 | `carry` metric for the suitcase carry | **Unchanged in the union; unprescribed.** `suitcase-carry` is retired | Nothing loads a carry now |
| `SPEC-V4.0.md` §6 | Benchmarks measured weeks 1, 8, 12 | **Weeks 1 and 12** | The plan names "+ benchmark" at week 12 only; week 6 is the deload and says to maintain positions, not chase ROM |
| `SPEC-V4.0.md` §7 | Autoregulation: first two sets a point high → cut 5–10% | **The plan's cut-specific list** — see §7 | The plan states its own conditions |
| `SPEC-V4.0.md` §8 | `SCHEMA_VERSION` 5 | **6.** `migrateToV6` recomputes every session phase from its week — see §8 | The v4 phase names are no longer members of `Phase` |
| `SPEC-V4.0.md` §9 | Seven target groups ending in "marathon" | **Seven groups ending in "cardio"** — see §9 | — |
| `SPEC-V2.0.md`, `SPEC-V3.0.md` §2/§4/§5/§6, `SPEC-V4.0.md` §5 (scales, metrics) | Sync, auth, storage key, plain performance model, 84-day navigation, service worker, reset tombstone, three RPE scales | **Unchanged** | — |

---

## 2. Weekly structure

| Day | `am` | `main` | `later` |
|---|---|---|---|
| Monday | Handstand GTG | Push A — HSPU priority | Moderate continuous cardio |
| Tuesday | — | Pull A — primary front lever | — |
| Wednesday | Front-lever GTG | Legs | — |
| Thursday | — | **—** (rest) | Flexibility A |
| Friday | Handstand GTG | Push B — weighted dip priority | HIIT |
| Saturday | — | Pull B — weighted pull + FL support | — |
| Sunday | — | Long low-intensity cardio | Flexibility B |

> **Push → Pull → Legs → Rest → Push → Pull → Rest**

The three cardio sessions are placed to minimise interference: Monday's
moderate session leaves ~48 hours before legs; Friday's HIIT is two days after
legs and several days before the next leg session; Sunday's low-intensity work
does not interfere with Monday's upper body.

The readiness check-in still gates the **main** session only. On Thursday there
is nothing to gate: the day opens straight onto its stretch.

---

## 3. Block structure

One arc. Both tables are lookups in `src/domain/phase.ts`, indexed by week —
the phases are not equal in length, so neither is arithmetic.

| Wk | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Phase | reentry | reentry | accum. | accum. | accum. | **deload** | intens. | intens. | intens. | intens. | realization | consolidation |
| RPE cap | 8 | 8 | 8.5 | 8.5 | 9 | 7 | 8 | 8.5 | 8.5 | 9 | 9 | 8 |

| Phase | Weeks | Goal |
|---|---|---|
| Re-entry | 1–2 | Establish the post-break baseline around RPE 8 |
| Accumulation | 3–5 | Gradually increase sets / difficulty |
| Deload | 6 | Volume −40–50%, RPE 6–7, same exercises, no failure, no skill tests |
| Intensification | 7–10 | Harder leverage / heavier loading |
| Realization | 11 | Highest-quality hard work without failure |
| Consolidation | 12 | Lower volume, benchmark and compare |

The RPE cap is the highest **strength-scale** RPE the plan prescribes that
week. Cardio prescribes RPE 9–9.5 on the run scale most weeks; that scale is
exempt from the cap, as it was in v4.0.

Week 6 is mandatory unless an unusual circumstance means you are already fully
recovered. It should leave you eager to train harder again.

---

## 4. Program content

All content lives in `src/data/program.ts`. Conventions:

- **One `Prescription` per table row.** Where the plan states one table and
  cross-references it — "progress exactly as Monday", "same strict rules as
  Monday" — the table is a shared constant (`RING_DIP`, `ACCESSORY`, `LOWER`)
  so the copies cannot drift apart.
- **A range on a field the type stores as one number takes the high end and
  records the range in `note`.** "2–3 sets" is `sets: 3, note: '2–3 sets'`;
  "80–90 min" is `minutesEach: 90, note: '80–90 min'`. Reps, seconds and RPE
  ranges are native.
- **The exercises are fixed across the block.** Reps, hold durations and
  exercise selection do not change; sets, RPE, cardio duration and flexibility
  volume do.

### Grease the groove

One round is the whole list; `sets` is the round count and `setsLabel:
'rounds'` makes the UI say so. All three GTG blocks share one rounds table:
**2, 2, 2, 3, 3, 1, 2, 2, 3, 3, 2, 1–2**. Everything is RPE 4–5. Do not progress
by making GTG exhausting; progress by better wall line, smaller toe contact,
cleaner and then repeated catches. Stop while attempts still feel crisp.

### Cardio

Three sessions, each on the `run` scale:

| Session | Day | Metric | Week 1 | Peak | Deload (wk 6) |
|---|---|---|---|---|---|
| Moderate continuous | Mon `later` | `runInterval` × 1 | 20 min @ 5.5 | 30 min @ 6.5 | 15–18 min @ 4–5 |
| HIIT | Fri `later` | `hold` 30 s, `restSeconds: 90` | 5 × 30 s @ 9 | 8 × 30 s @ 9.5 | 4 × 30 s @ 8 |
| Long low-intensity | Sun `main` | `runInterval` × 1 | 45 min @ 2–3 | 80–90 min @ 2–3 | 40–45 min @ 2 |

The HIIT session is three exercises — warm-up, intervals, cooldown — so the
interval count is a set count and the end-of-block target can read it. Progress
the number of **quality** intervals first; once eight are established, improve
average output while retaining all eight.

### Flexibility

Two sessions, six items each, on the `stretch` scale. **Flexibility A** runs
two set tables — `FLEX_A_LOADED` for the Cossack, pancake good morning and
lift-off, `FLEX_A_STATIC` for the three holds — against one RPE table.
**Flexibility B** runs one table. Neither ever needs RPE 8+.

### Carried-over ids

Forty-three v4.0 exercises keep their ids because they are the same movement in
the same role, even where the day moved: every GTG item on Monday and Wednesday;
`hspu-primary`, `hspu-secondary`, `ring-dip`, `ring-dip-secondary`,
`ring-pullup`; `fl-hold-primary`, `fl-raise`, `fl-row-banded`; `hack-squat`,
`bulgarian-split-squat`, `nordic-curl`, `calf-raise-b`, `tibialis-raise`;
`lateral-raise`, `lateral-raise-c`, `overhead-triceps-ext`, `cable-triceps-ext`;
`dragon-flag`, `standing-ab-wheel`, `windshield-wiper`; `fri-am-chest-to-wall`,
`fri-am-toe-pulls`; and all twelve `flexa-*` / `flexb-*` items.

Fourteen ids are new: `mon-moderate-cardio`, `rear-delt-fly`, `wall-curl`,
`fri-am-wrist-lean`, `fri-am-fingertip-shifts`, `fri-am-wall-release-catch`,
`cable-crunch`, `weighted-side-plank`, `fri-hiit-warmup`, `fri-hiit-intervals`,
`fri-hiit-cooldown`, `fl-hold-banded`, `hammer-curl`, `sun-long-cardio`.

Twenty-four v4.0 records moved verbatim into `src/data/retiredExercises.ts`,
with v4.0's authoring helpers frozen alongside them so the copies expand to
exactly what they prescribed. No historical `exerciseId` is rewritten.

The progression ladders are **unchanged**: the plan's §7 chains are the v4.0
chains.

---

## 5. Metrics and RPE scales

Unchanged from SPEC-V4.0.md §5. `carry` stays in the union, unprescribed.

The plan's RPE table for resistance work is the `strength` scale; its
"technical failure" definitions are the stop rules on every skill movement —
front lever hips drop, HSPU ROM shortens or the line collapses, a ring dip loses
stable depth or lockout. The set ends when the standard breaks.

---

## 6. Flexibility benchmarks

The same six measurements as v4.0, taken in weeks **1 and 12**
(`BENCHMARK_WEEKS`). Progress **ROM → control → load**, never pain tolerance.

---

## 7. Autoregulation and guardrails

**Cut-specific autoregulation.** Reduce load or volume that day if: the first
work set is ~1 RPE above prescription; performance falls more than 10–15% across
sets; multiple nights of poor sleep have accumulated; joints or tendons are
becoming progressively irritated; bodyweight is dropping much faster than
intended and strength is falling.

Do **not** compensate for poor recovery by training to failure, adding
unscheduled sets, turning Sunday cardio into a race, or testing HSPU / front
lever every week.

The within-session **Performance Drop Rule** and the **joint/tendon rule** are
unchanged from v4.0. Joint-volume warnings still derive their days from
`program`; the Achilles set now covers the three cardio sessions and the calf
and tibialis work.

---

## 8. Storage

`SCHEMA_VERSION` becomes **6**. `migrateToV6` recomputes every
`SessionLog.phase` from its week — the v4 names describe waves that no longer
exist, and phase has always been a pure function of week. Nothing else changes.
No `exerciseId` is rewritten. The localStorage key stays `block12:v1`; the
Supabase schema is untouched.

---

## 9. End-of-block benchmarks

Seven groups in `src/data/targets.ts`; item order is load-bearing. Auto-checked
where computable: body weight against `settings.targetWeightKg`; both HSPU
slots improved on week 1; the front lever at open advanced tuck or beyond for
≥5 s; ring dip, pull-up and hack squat at ≥95% of block best (the block
promises to *hold* these through a cut); dragon flag, rollout and wiper improved
on week 1; every flexibility benchmark moved the right way between weeks 1 and
12; the moderate session at 30 min, eight HIIT intervals in one session, and the
long session at 80+ min.

> **Retain almost all muscle and absolute strength while improving relative
> strength, skill efficiency, body composition, flexibility and cardiovascular
> fitness.**
