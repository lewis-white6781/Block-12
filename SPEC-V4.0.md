# BLOCK 12 — SPEC AMENDMENT v4.0

**Status:** authoritative amendment to `SPEC.md`, `SPEC-V1.1.md`, `SPEC-V2.0.md`
and `SPEC-V3.0.md`.
**Baseline:** v3.0.0 (tag `v3.0.0`).
**Source of the training content:**
[`12_week_hybrid_marathon_calisthenics_plan.md`](./12_week_hybrid_marathon_calisthenics_plan.md),
which is kept in the repo as the transcription source. Where this file
paraphrases that document, the document wins.

This file does **not** replace the earlier specs wholesale. It replaces the
**training content** and the **periodisation** completely, and leaves the app's
architecture — sync, auth, storage, formatting, navigation, the service worker,
the plain performance model — standing. Every superseded line is listed in §1
so the disagreement is explicit rather than accidental.

---

## 0. Why this amendment exists

The block changed goal. v1–v3 programmed a calisthenics-and-cut block whose
cardio was one Sunday run and one sprint session. The athlete is now training
for a marathon while holding onto the calisthenics, so running becomes the
priority and the lifting reorganises around it.

That is not a content swap. Four things about the *shape* of the plan do not
fit the v3 data model:

| # | Problem | Nature |
|---|---|---|
| 1 | Wednesday now runs a morning grease-the-groove block, a full-body lift **and** an evening recovery run. `Block = 'am' \| 'main'` has no third slot, and session ids are `${date}:${block}`, so the recovery run had nowhere to live. | **spec change** — a third `Block` value |
| 2 | Periodisation became three four-week waves deloading at 4, 8 and 12. The v3 `Phase` union describes one arc deloading at 6, and `phaseRpeCap` derives the RPE ceiling from those phase names. | **spec change** — replaces `SPEC.md` §6.1, §6.6 |
| 3 | Runs are prescribed as N blocks of a fixed duration at a stated RPE. The v3 `distanceTime` metric stored minutes in `SetLog.reps` and captured no RPE at all, and the RPE stepper's 6–10 range made an easy run at RPE 2 literally unloggable. | **spec change** — new metric, new RPE scales |
| 4 | Flexibility is now two prescribed sessions with their own RPE table and six long-term goals, replacing daily AM mobility. The v3 model had no session for them and no way to log a stretch's RPE. | **spec change** — replaces `SPEC.md` §5.9 |

Problem 1 is the load-bearing one: without a third block the plan cannot be
represented at all.

---

## 1. Amendments to the earlier specs

| Source | Says | v4.0 replacement | Why |
|---|---|---|---|
| `SPEC.md` §5 (all) | The 7-day calisthenics split, exercise by exercise | **Replaced in full.** The weekly structure, every exercise and every prescription come from the hybrid marathon plan — see §2–§4 | The block's goal changed |
| `SPEC.md` §5.9 | Six mobility benchmarks (knee-to-wall, pike reach, pancake torso, shoulder lift-off, 90/90, wrist lean) measured weeks 1/6/12 | **Six flexibility benchmarks**, one per progression chain, measured weeks **1/8/12** — see §6 | The chains are what the plan trains; week 6 is now an overload week, so a mid-block flexibility test there measures fatigue |
| `SPEC.md` §5.10 | End-of-block targets in six groups | **Seven groups** from the plan's own §9 — see §9 | The objectives changed with the block |
| `SPEC.md` §6.1 | `calibration`/`accumulation`/`deload`(6)/`intensification`/`peak`/`taper`/`test` | **Three waves**: baseline, reinforce, overload, deload / rebuild, overload, peak, deload / rebuild, overload, marathonPeak, taper — see §3 | Deloads move to 4, 8, 12 |
| `SPEC.md` §6.6 | `phaseRpeCap(phase, exerciseId)`, with test week uncapped for the four test lifts | **`weekRpeCap(week)`**, read off the plan's own weekly tables. No test-lift exemption — v4.0 has no test week | The plan states its maximum RPE per week directly; inferring it from a phase name was always a proxy |
| `SPEC.md` §6.6 | Stop rule: reps/seconds ≥15% below the rolling best of the last 3 sessions | **Performance Drop Rule**: >15% below the **first working set of this session** — see §7 | The plan states the within-session form. "Today's third set vs a PR three weeks ago" answers a different question |
| `SPEC.md` §6.9 | Optional second run, gated on four conditions from week 3 | **Deleted.** Running is prescribed, not earned | The gate keyed off the Wednesday sprint session, which no longer exists; the plan prescribes 5–6 runs a week outright |
| `SPEC.md` §6.10 | Elbow warnings on Tue/Fri, shoulder on Mon/Sat | **Derived from `program`**, plus a third joint: **Achilles** — see §7 | Hardcoded days silently became wrong the moment the split moved |
| `SPEC.md` §7.1 | Today shows an AM checklist and a MAIN/RUN card | **Three cards** — AM, Main, Later — each hidden when the day prescribes nothing for that slot | Wednesday needs three; Thursday needs one |
| `SPEC-V1.1.md` §2 | Every AM exercise is `tracked: true`; AM is daily mobility | AM is **grease the groove on Mon/Wed/Fri only**, prescribed in **rounds** of the whole list. Still `tracked: true` | Daily mobility is gone; the plan replaces it with skill practice at RPE 4–5 |
| `SPEC-V3.0.md` §3 | Monday main slots 1 and 3 are Partial ROM wall HSPU and Belly-to-wall HSPU negative | **Superseded** by Full Body A — see §4. Both records move to `retiredExercises.ts` | Monday is a full-body day now |
| `SPEC-V3.0.md` §2 | The plain performance model: no unitless indices, variant difficulty is a grouping key | **Unchanged and extended.** `BestKind` gains `minutes` and `carry`; both are units, not scores | The rule was right |
| `SPEC-V2.0.md` (all) | Supabase sync, email OTP, `block12:v1`, localStorage as source of truth | **Unchanged.** `block_state` is six `jsonb` columns keyed on top-level state names, which are content-agnostic | No SQL migration is needed for a content change |

---

## 2. Weekly structure

| Day | `am` | `main` | `later` |
|---|---|---|---|
| Monday | Handstand GTG | Full Body A — HSPU & heavy dip | — |
| Tuesday | — | Quality run — threshold | Flexibility A |
| Wednesday | Front lever GTG | Full Body B — front lever, heavy pull, lower body | Recovery run (weeks 3, 5–12) |
| Thursday | — | Easy run | — |
| Friday | Mixed GTG | Full Body C — mixed calisthenics & physique | — |
| Saturday | — | Easy run + strides | — |
| Sunday | — | Long run | Flexibility B |

`Block` is therefore `'am' | 'main' | 'later'`. Session ids stay
`` `${date}:${block}` ``, so every id written before v4.0 remains valid.

The readiness check-in gates the **main** session only. AM is RPE 4–5 skill
practice and `later` is a recovery jog or a stretch; neither is a session you
would autoregulate out of, and asking would put a five-slider form in front of
a ten-minute jog.

> **Hard work is hard. Easy work stays genuinely easy.**

---

## 3. Loading waves

Three four-week waves. `phaseForWeek` and `weekRpeCap` are lookup tables in
`src/domain/phase.ts`, indexed by week — the waves are not uniform, so neither
is derivable by arithmetic.

| Wk | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Phase | baseline | reinforce | overload | deload | rebuild | overload | peak | deload | rebuild | overload | marathonPeak | taper |
| Wave | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 |
| RPE cap | 8 | 8.5 | 9 | 7 | 8.5 | 9 | 9 | 7 | 8.5 | 9 | 8.5 | 7.5 |

The RPE cap is the **highest RPE the plan itself prescribes that week**, read
off its tables. A set logged above it means the session drifted off plan.

Week 7 is the highest gym loading of the block. Week 11 peaks the long run and
steps gym volume back to pay for it. Week 12 reduces fatigue; the race taper
continues after the block ends.

---

## 4. Program content

All content lives in `src/data/program.ts`. Two conventions:

**`sets: 0` means "not prescribed this week."** `exercisesFor` drops it. It
must be authored explicitly, because `resolvePrescription`'s nearest-earlier
fallback would otherwise fill the gap with a neighbouring week's numbers. Two
exercises rely on this:

- `wed-recovery-run` — no volume in weeks 1, 2 and 4.
- `sun-long-run-finish` — exists only in weeks 9, 10 and 11.

**The exercises are fixed across the block.** Reps, hold durations and exercise
selection do not change. What moves is sets, RPE, running volume and
flexibility volume. Load, leverage, ROM and band assistance are the athlete's
dials for hitting the prescribed RPE — which is why so many prescriptions carry
a constant rep count against a moving RPE.

### Grease the groove

One round is the whole list, so `sets` on each item **is** the round count, and
`setsLabel: 'rounds'` makes the UI say so. Every GTG item in the block shares
one rounds table: **2, 2, 3, 1, 3, 3, 3, 2, 3, 3, 2, 1**. Everything is RPE 4–5;
toe pulls never exceed RPE 5. The objective is repeated successful balance
corrections over months, not one exhausting handstand attempt.

### The long run

Split into two exercises so the marathon-specific finishes are data rather than
a note. `sun-long-run` carries the base blocks at RPE 2.5–3;
`sun-long-run-finish` carries the closing blocks that run faster on tired legs
(weeks 9–11 only). Their set counts sum to the plan's totals:

| Wk | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Blocks × 15 min | 5 | 6 | 7 | 5 | 7 | 8 | 9 | 6 | 9 | 10 | 11 | 8 |

Cap the longest run at 30–32 km even where the time prescription would take you
farther.

### Carried-over ids

Three exercises keep their pre-v4 ids because they are the same movement in the
same role, so their charts span both blocks: **`ring-dip`** (Monday's primary
dip), **`ring-pullup`** (Wednesday's heavy pull) and **`fl-raise`** (Friday's
front lever raise). Everything else from v1–v3 moves verbatim into
`src/data/retiredExercises.ts`. No historical `exerciseId` is ever rewritten.

---

## 5. Metrics and RPE scales

`MetricType` gains two members:

- **`runInterval`** — one prescribed run block: `minutes` + `rpe`, plus an
  optional `distanceM` so pace is derivable. `SetLog.minutes` is its own field.
  The pre-v4 `distanceTime` metric stored minutes in `reps`, which is why run
  data was indistinguishable from rep data everywhere downstream.
- **`carry`** — a loaded carry: `distanceM` + `addedKg` + `rpe`. Compared
  load-first like `weightedReps`, since the metres are prescribed and fixed.

`sprint` and `distanceTime` stay in the union. Nothing prescribes them, but
`retiredExercises` entries are typed `Exercise` and historical logs resolve
through them.

`Exercise.rpeScale` selects one of the plan's three RPE tables, because they do
not share bounds:

| Scale | Range | Read as |
|---|---|---|
| `strength` (default) | 6–10 | reps in reserve; RPE 8 = two more perfect reps |
| `stretch` | 5–8 | 6 is a clear stretch, 8 is very strong but no pain. 9–10 is not used |
| `run` | 1–10 | easy work genuinely sits at 2 |

Isometric holds read the strength scale as **clean seconds remaining**. A front
lever hold ends when the position deteriorates, not when gravity finally wins.

The RPE-10 and week-cap stop rules apply to the `strength` scale only. A stretch
at RPE 7 and an easy run at RPE 2 mean something else entirely.

---

## 6. Flexibility

Six benchmarks, one per progression chain, measured in weeks **1, 8 and 12**
(`BENCHMARK_WEEKS` in `src/data/mobility.ts`). Every one is a distance in
centimetres from a body landmark to the floor or past a reference point,
because that is what can be re-measured months apart without arguing about it.
Three are lower-better — they measure how far you still are from the floor.

| Benchmark | Direction |
|---|---|
| Pancake — chest height off floor | lower is better |
| Middle split — hip height off floor | lower is better |
| Front split — rear hip height off floor | lower is better |
| Pike — reach past the toes | higher is better |
| Wall shoulder-flexion lift-off | higher is better |
| Bridge — shoulders past the hands | higher is better |

Progress loaded mobility **ROM → control → load**, never pain tolerance.
Sunday's Flexibility B is deliberately lower volume than Tuesday's A: it must
never become a second hard lower-body workout on top of the long run.

---

## 7. Autoregulation and guardrails

**Autoregulation.** If the first two sets of a prescribed RPE 8 unexpectedly
feel like RPE 9, reduce load, leverage, ROM or skill difficulty by 5–10%. Do not
turn a planned RPE 8 day into an accidental RPE 10 session. The existing
sleep/soreness adjustment (−0.5 RPE on <6 h sleep or soreness 3) is unchanged.

**Performance Drop Rule.** If a set falls more than ~15% below the **first
working set of this session**, remove the final set, reduce load, or regress the
skill. This replaces `SPEC.md` §6.6's rolling-best comparison. The plan's point
is that a session which decays by 15% from where it started has already given
you its useful work — a fact about today, which comparing against a PR from
three weeks ago does not establish.

**Joint/tendon rule.** Immediately reduce or remove the high-strain movement on
sharp pain, tendon pain increasing through the warm-up, sudden loss of strength,
persistent elbow/shoulder/**Achilles** irritation, or pain that changes movement
mechanics. Do not attempt to "RPE through" tendon pain.

`Readiness` therefore gains `achillesIrritation`. Joint-volume warnings now
cover three joints, and the days they fire on are **derived from `program`** —
a day warns about a joint when it actually loads it.

---

## 8. Storage

`SCHEMA_VERSION` becomes **5**. `migrateToV5` in `src/store/persist.ts`:

- Recomputes every `SessionLog.phase` from its week. The old names describe a
  periodisation that no longer exists; phase was always a pure function of week,
  so nothing that could not be re-derived is lost.
- Defaults `readiness.achillesIrritation` to 0 on check-ins that never asked.
  It is the only honest default, and it is the value that keeps the new Achilles
  warning silent about history it cannot speak to.
- Rewrites **no** `exerciseId`.

The localStorage key stays `block12:v1`. The Supabase schema is untouched:
`block_state` is six `jsonb` columns keyed on top-level `PersistedState` field
names, and `pullRemote` already funnels through the same `migrate()`.

The sets CSV gains a `minutes` column.

---

## 9. End-of-block objectives

Seven groups in `src/data/targets.ts`. Item **order is load-bearing** —
`checkEndOfBlockTargets` matches on group id plus item index, so reordering an
item moves its auto-check onto a different claim.

Auto-checked where it is computable: body weight against
`settings.targetWeightKg`; `ring-pullup` and `ring-dip` at ≥95% of block best
(the block promises to *maintain* these through a cut, not improve them); the
front lever at open advanced tuck or harder; HSPU, dragon flag, standing ab
wheel and windshield wiper improved on week 1; every flexibility benchmark
moved the right way between weeks 1 and 12; the long run reaching 120 minutes
in one session; and week 12's runs actually run. Everything else is a manual
checklist item.

The goal is to finish the twelve weeks **leaner, aerobically stronger, more
marathon-ready, at least as muscular, relatively stronger, better at front lever
and HSPU progressions, and meaningfully more flexible — without accumulating
unnecessary fatigue.**
