# Block 12 — Project Overview (for external analysis)

> A single-document snapshot of what this project is, how it is built, and every
> feature it currently has. Written 2026-09-12 against version **5.1.0**
> (branch `master`).

---

## 1. What it is

**Block 12** is a single-user, offline-first, installable **PWA** (progressive web app)
that runs one fixed **12-week calisthenics-priority cut** on a push / pull / legs split.
It is a personal training tracker built for exactly one athlete (the author), not a
general-purpose fitness app.

The goal of the block it runs: go from **80 kg → ~73 kg** over twelve weeks while
holding almost all absolute strength and progressing two skills — the **front lever**
and the **handstand push-up (HSPU)** — plus flexibility and cardio fitness.

The app's job is to:

1. Tell the athlete exactly what to do today (the prescription is fixed by the plan,
   not chosen by the user).
2. Log every set, hold, run interval, stretch, and daily body/nutrition entry as
   quickly as possible on a phone, one-handed.
3. Enforce the plan's own rules live during a session (stop rules, RPE caps, autoregulation).
4. Detect stagnation and tell the athlete which *one* variable to change next.
5. Show progress in real units (reps, seconds, kg, cm) — never a made-up score.
6. Sync across phone and laptop without ever losing offline data.

The whole thing was built by working through a written specification with an AI
coding agent (Claude Code), and the specs are checked into the repo and are
authoritative over the code.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| UI | React 19, react-router-dom 6 (HashRouter) |
| State | zustand 5 with `persist` → `localStorage` key `block12:v1` |
| Styling | Tailwind CSS 3 + design tokens in `src/styles/tokens.css`; dark theme only; fonts Archivo (display) + Inter |
| Charts | recharts 3 |
| Dates | date-fns 4 |
| Build | Vite 8, `tsc -b` project references |
| Tests | vitest 4 + jsdom (domain unit tests, data-integrity tests, render smoke tests) |
| Lint | oxlint |
| Cloud sync | Supabase (Postgres + Auth) — anon key only, one `block_state` row per user, RLS |
| Hosting | Vercel (`vercel.json`) |
| PWA | `public/manifest.webmanifest`, generated service worker (`public/sw.template.js` → `dist/sw.js` via `scripts/build-sw.mjs`) |

Scripts: `npm run dev · build · test · typecheck · lint`.

---

## 3. Repository layout

```
SPEC.md, SPEC-V1.1.md … SPEC-V5.0.md   Authoritative spec + amendments (newest wins)
updatedblock20.md                       The training plan v5.0 content is transcribed from
12_week_hybrid_marathon_calisthenics_plan.md   The v4.0 plan (kept for provenance of retired exercises)
CLAUDE.md / AGENTS.md                   Rules for the AI coding agent working in the repo
CHANGELOG.md                            Full release history 1.0 → 5.0
supabase/schema.sql                     Cloud table + RLS policies
public/sw.template.js                   Service-worker source
scripts/build-sw.mjs                    Stamps CACHE_VERSION into dist/sw.js at build time
src/
  data/        program.ts (ALL prescriptions), exercises.ts, ladders.ts, mobility.ts,
               targets.ts, retiredExercises.ts
  domain/      Pure, tested maths: phase, performance, scoring, analysis, readiness,
               body, review, units, format, clock, id, types
  store/       zustand store + persist/migrations (SCHEMA_VERSION = 6)
  sync/        Supabase sync engine, LWW merge, sync status store
  pwa/         Update detection + swap logic
  screens/     Today, SessionRunner, Progress, Body, Program, Review, Settings, Auth
  components/  ExerciseCard, SetLogger, NumberPad, HoldTimer, RestTimer,
               StopRuleBanner, ReadinessCheckIn, ProgressionLogger, WeightChart,
               ProgressChart, PhaseBadge, BenchmarkForm, DailyEntryFields, PagerNav,
               Sheet, SyncPill, UpdateToast, …
  dev/         demoSeed.ts — seeds 6 weeks of plausible data (dev builds only)
```

Hard architectural rules (from CLAUDE.md):

- **All metric maths lives in `src/domain/` as pure functions with tests.** Components
  read results, never compute them.
- **All program content lives in `src/data/program.ts`.** No prescription is ever
  hardcoded in JSX. Content is transcribed *exactly* from the plan document — one
  `Prescription` per table row; nothing is invented.
- Sync code (`src/sync/`) never mixes with domain maths.
- Weights are **kg-native** in the domain and in storage/export; kg/lbs is display-only.
- Nothing displayed exceeds 2 decimal places (everything routes through `format.ts`).
- No unitless numbers anywhere in the UI.
- Exercise ids and ladder variant ids are **never renamed or deleted** (they live in
  historical logs). Retired exercises move verbatim to `retiredExercises.ts`.
- The localStorage key never changes; schema changes get a real migration.
- Mobile-first at 380 px, tap targets ≥ 44 px, dark theme.

---

## 4. The training block the app runs (v5.0)

### Weekly structure — three slots per day: `am`, `main`, `later`

| Day | `am` | `main` | `later` |
|---|---|---|---|
| Mon | Handstand grease-the-groove | **Push A** — deficit pike HSPU priority | Moderate continuous cardio (20→30 min) |
| Tue | — | **Pull A** — primary front lever | — |
| Wed | Front-lever GTG | **Legs** — hack squat, Bulgarian, Nordic, calf, tibialis | — |
| Thu | — | **rest (no main session)** | Flexibility A |
| Fri | Handstand GTG | **Push B** — weighted ring dip priority | HIIT (5→8 × 30 s / 90 s) |
| Sat | — | **Pull B** — heavy weighted pull-up + banded lever | — |
| Sun | — | Long low-intensity cardio (45→90 min) | Flexibility B |

Push → Pull → Legs → Rest → Push → Pull → Rest. Session ids are `${date}:${block}`.
A day simply hides any slot it prescribes nothing for.

### Block structure — one arc, one deload

| Week | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Phase | re-entry | re-entry | accum. | accum. | accum. | **deload** | intens. | intens. | intens. | intens. | realization | consolidation |
| Strength RPE cap | 8 | 8 | 8.5 | 8.5 | 9 | 7 | 8 | 8.5 | 8.5 | 9 | 9 | 8 |

Phase is a pure function of week (`phaseForWeek`), and the RPE ceiling is
`weekRpeCap(week)` — the highest RPE the plan itself prescribes that week.

### Content conventions

- ~57 active exercises; 43 carried their ids over from v4.0 so charts span both blocks.
- Exercises are fixed for the whole block; only sets, RPE, cardio duration and
  flexibility volume change week to week.
- Shared weekly tables the plan cross-references (`RING_DIP`, `ACCESSORY`, `LOWER`,
  `FLEX_A_LOADED`, `FLEX_A_STATIC`) are authored once so copies cannot drift.
- Grease-the-groove is prescribed in **rounds** of the whole list (2,2,2,3,3,1,2,2,3,3,2,1–2)
  at RPE 4–5; the UI says "rounds", not "sets".
- `sets: 0` means "not prescribed this week" and the exercise is dropped for that week.
- Three **RPE scales** with different bounds: `strength` 6–10, `stretch` 5–8, `run` 1–10.
- Six flexibility **benchmarks** measured in weeks 1 and 12.
- **Progression ladders** (variant chains) for the skills: front lever, HSPU/handstand,
  ring dip, pull-up, plus assistance tiers (none / light / medium / heavy band).

### Metric types

`reps`, `weightedReps` (reps + added kg), `hold` (seconds), `attempts` (handstand:
several timed attempts per set), `timeOnly` (completion), `runInterval` (minutes + RPE +
optional distance), `carry`, plus retired `sprint` and `distanceTime` kept for old logs.

---

## 5. Data model (stored in localStorage and mirrored to Supabase)

- **Settings** — block start date, start/target weight (80 → 73 kg), protein target
  band (170–190 g), optional carb/fat bands, weight unit (kg/lbs), `resetAt` tombstone.
- **SessionLog** — one per `${date}:${block}`: week, phase, day, startedAt/completedAt,
  readiness check-in, `exercises[]` each with `sets[]` (SetLog), session RPE, note,
  `updatedAt`.
- **SetLog** — reps / seconds / attempts[] / addedKg / minutes / distanceM / rpe /
  variantId / assistanceTier / romCm (pad height, lower = deeper) / technique flags
  (`hipsSagged`, `elbowsUnlocked`, `lineChanged`, `usedMomentum`, `partialROM`,
  `collapsed`, `assistedExtra`).
- **Readiness** — sleep hours, soreness, elbow / shoulder / Achilles irritation,
  motivation (0–3 scales).
- **DailyEntry** — per date: fasted morning weight, calories, protein/carbs/fat, steps,
  note. Calories auto-derive from macros (4/4/9) unless typed directly.
- **BenchmarkEntry** — flexibility measurements (cm / degrees) per benchmark week.
- **ProgressionEvent** — "I changed axis X on exercise Y from A to B" (the one-variable rule).
- **DecisionEntry** (v5.1) — one per decision: event date vs entry date (retrospective
  entries are labelled), source, frozen evidence snapshot, verbatim recommendation +
  the rule version that produced it, decision (accepted / deferred / rejected /
  overridden / manual), action, expected observation, follow-up window, optional link
  to a ProgressionEvent, and the follow-up itself (comparable-session count, observation,
  outcome — including `notComparable` and `insufficientData` — and interpretation,
  kept separate).
- **CaseStudyProtocol** (v5.1) — a single versioned measurement protocol: question,
  observation window, anchor exercises, baseline/endpoint windows, comparison and
  missing-data rules, plus a frozen note about how much data existed at creation
  (retrospective flag) and an append-only amendment list (date + reason + change).

`SCHEMA_VERSION` is 7; migrations run on load (v5 recomputed phases + added Achilles,
v6 recomputed phases again for the new phase names, v7 added the two analytics
collections with empty defaults). Both new collections sync through the same LWW
merge and respect the reset tombstone; the Supabase row gained two nullable jsonb
columns (`supabase/migration-v5.1-analytics.sql`).

---

## 6. Features, screen by screen

Bottom tab bar: **Today · Progress · Body · Program · More**. Session Runner is full-screen.

### Today (default)
- Phase badge (week number + phase, colour-coded), date, day title.
- **Day pager**: every one of the 84 block days is reachable, past and future, with a
  7-dot week strip marking days that have logged sets; future days show "Upcoming";
  past week 12 shows a "Block complete" banner (never a lock-out).
- Cards for each slot the day prescribes (`am` / `main` / `later`), listing exercises
  with their exact prescription for this week ("4 × 5–8 s @ RPE 7", "2 rounds", etc.).
- **Start session** → readiness check-in (5 sliders) → Session Runner (main slot is
  gated by the check-in; AM/later are not).
- **Stagnation card** (the headline feature) when an exercise has been flat for 3
  sessions *and* recovery is healthy: names the next unused axis on that exercise's
  progression ladder ("Next lever: greater ROM") with an **Apply** button. If flat but
  recovery is poor, a different card blames recovery and does not suggest difficulty.
- **Joint-volume warnings** (elbow / shoulder / Achilles) when recent check-ins report
  irritation ≥ 2 on days that load that joint — days are derived from the program.
- Inline **daily entry fields** (weight, calories, protein, carbs, fat) always visible,
  with 7-day average and weekly rate.
- **Benchmark form** on benchmark weeks (1 and 12); mobility "do not progress" conditions
  and weekly progression variables shown from `mobility.ts`.

### Session Runner
- One exercise at a time, arrows between them; target row shows the prescription,
  "last time" numbers and best set so the athlete knows what to beat.
- **Custom number pad sheet** (no OS keyboard); ± steppers for reps and RPE; RPE steps
  by 0.5 on the exercise's own scale with the reserve description shown.
- **HoldTimer** for holds/attempts (start/stop, auto-fills seconds); run-interval
  layout for cardio (minutes prefilled, RPE, optional distance).
- Variant / assistance-tier pickers from the exercise's ladder; added-kg entry
  (kg or lbs display); ROM cm where the exercise progresses on ROM; technique flag chips.
- **Rest timer** auto-starts on log (exercise-specific or bucketed by metric), audible +
  vibration, persistent bar.
- **StopRuleBanner** (live): ≥15% quality drop *within the session* vs its first working
  set → amber "end this exercise"; any technique flag → names the flag; two consecutive
  `collapsed` on a handstand → red "stop balance work today"; RPE 10 on the strength
  scale → amber; RPE over this week's cap → amber. Run/stretch scales are exempt.
- **Autoregulation**: sleep < 6 h or soreness 3 → "Adjusted for recovery", −0.5 RPE
  suggested on every target (never silently rewrites the prescription).
- **Progression logger** with the **one-variable rule**: a second change on the same
  exercise in the same week is blocked with an explanation; override is allowed but
  recorded and counted in Review.
- **Autosave on every set** — killing the app mid-session loses nothing; reopening
  resumes. Session end captures session RPE and a note, then triggers a sync.

### Progress
- **Skill headline cards** (front lever, HSPU/handstand, ring dip, pull-up): best in the
  movement's own unit, trend arrow, the figure four weeks ago, and a breakdown by
  variant and assistance tier — like compared with like.
- Per-skill **best-by-week sparkline**.
- **Per-exercise chart** with picker: "Best set" and "Total volume" in the real unit;
  where there is a load, **two separate 1RM estimates** — "Est. 1RM (kg)" (absolute
  Epley) and "Est. 1RM ÷ BW" (bodyweight-relative). They are separate because the
  ratio mechanically rises as bodyweight falls even when absolute output is flat.
  Both require a measured rolling-average bodyweight near the session date — no
  fallback to the configured start weight. Phase bands shaded; deload labelled.
- **Progression events** list with tap-to-read details.
- **Consistency**: 12 × 7 heatmap of sessions completed + streak counter.
- **Flag frequency**: technique flags per exercise (which skill degrades under fatigue).

### Body
- Weight chart: daily dots, 7-day rolling line, shaded **target corridor** (straight
  line 80 → 73 kg, ±1 kg band), dashed projected finish.
- Corridor status: on track (−0.30 to −0.60 kg/wk) / too slow (with projected week-12
  weight) / too fast (lean-mass warning). The corridor judges the current weekly RATE.
- **"vs plan" stat** (v5.1): the rolling average against the straight-line 80 → 73 kg
  trajectory computed from real elapsed calendar days — a separate question from the
  rate corridor, displayed as ahead/behind in kg. If the configured target ever
  requires a rate the corridor cannot deliver, a warning flags the contradiction
  instead of silently reconciling it.
- Calories, protein, carbs, fat — last-7-days bars with target bands where set.
- Weekly summary table: mean weight, change, rate %, mean kcal, mean protein, sessions.

### Program
- Full 12-week plan browser by day and week: every slot, every exercise, its
  prescription for the selected week, cues, progression ladder, stop rules.
- Reference sections transcribed from the plan: the RPE tables (strength / stretch /
  run), cut-specific autoregulation list, joint & tendon rule, and "what progress means
  during a cut".

### Review (weekly)
- Sessions planned vs completed per slot; weight and nutrition summary; skills this
  week; fired stop-rule flags; tendon guardrails (exercise churn, leverage jump,
  collapse training); one-variable overrides count; phase note for the week.
- **Data coverage card** (v5.1): weight and calorie days out of 7, sessions against
  the planned denominator with `unknown` slots (date passed, nothing recorded)
  explicitly distinct from missed sessions, and a count of daily entries written
  after the day they describe.
- **Decisions card** (v5.1): decisions recorded / accepted / overridden this week,
  due follow-ups, and a link to the journal.
- **Week-12 target checklist**: seven groups (body composition, HSPU & handstand,
  front lever, strength, core, flexibility, cardio). Auto-checked where computable —
  e.g. at target weight, HSPU improved vs week 1, front lever ≥ 5 s at open advanced
  tuck or beyond, ring dip / pull-up / hack squat held at ≥ 95% of block best, every
  flexibility benchmark moved the right way, 30-min moderate session, eight HIIT
  intervals, 80+ min long session.

### More / Settings
- Block start date; weight unit; start & target weight; protein / carb / fat targets.
- **Sync** status and manual sync.
- **Your data**: Export JSON, Import JSON, Export sets CSV, Export daily CSV, and
  (v5.1) **Export analysis pack** — eight files: sets, sessions, daily entries,
  planned sessions (including dates with no log), exercise definitions and decisions
  as tidy CSVs, plus a provenance manifest (versions, counts, weekly coverage,
  demo-data flag) and a data dictionary documenting grain, join keys and the
  daily-grain join trap. Built for independent analysis in Tableau / Python / SQL.
- **Case study** (v5.1): create, view and amend the versioned protocol; export
  `protocol.md`; open the decision journal.
- **Danger zone**: Reset block (two-step confirm) — tombstoned so sync cannot resurrect it.
- Developer (dev build only): load demo block. The seed stamps
  `settings.demoSeededAt` so exports can never pass demo data off as genuine.
- About: version and update-channel info.

### Decision journal (v5.1, `/decisions`)
- Reached from More, Review, the Today stagnation card ("Record decision" — the
  entry freezes exactly what the card said) and the Session Runner's progression
  logger (which links the saved ProgressionEvent by id).
- New-entry form: source, optional exercise, evidence snapshot, verbatim
  recommendation, decision, action, reason, expected observation, follow-up window
  (defaulting from the protocol). A few taps plus optional sentences — journalling
  is never required to log a set.
- Each entry shows its follow-up state: waiting (n of N comparable sessions — sessions
  after the decision with a qualifying set of that exercise), due, or recorded.
  Follow-ups capture the observation, an outcome (improved / maintained / declined /
  not comparable / insufficient data) and an interpretation, separately.
- Due follow-ups surface as a small nudge on Today and inside Review.

### Auth
- Email OTP / magic link via Supabase, locked to one allow-listed address. The app is
  fully usable offline; auth only gates the cloud mirror.

---

## 7. Sync, offline and updates

- **localStorage is the source of truth.** Every read and write is local first.
- **Sync** to Supabase is periodic and event-triggered — ~30 s interval, on foreground,
  on reconnect, on every local write, on finishing a session, or manually. No realtime
  subscriptions. One JSON row per user (`block_state`) protected by row-level security.
- **Merge** is a pure, tested **last-write-wins per record** (`updatedAt`), union of keys.
  `settings.resetAt` acts as a tombstone cutoff so "Reset block" is not undone by the next
  pull. Local records are never dropped by a merge.
- Only the anon/public Supabase key is ever shipped client-side.
- **PWA updates**: the service worker is generated with a cache version derived from the
  built output. It never calls `skipWaiting()` on install; the page checks for updates on
  foreground, reconnect and every 15 min, and swaps only when safe — visible and not inside
  a running session — after flushing local writes first. An **UpdateToast** offers the
  swap.
- `useToday` resyncs at midnight and on foreground so an installed app that is never
  reloaded still advances its day.

---

## 8. Domain engine summary (`src/domain/`)

| File | What it computes |
|---|---|
| `phase.ts` | week from date, phase from week, weekly RPE cap, prescription resolution (exact week, else nearest earlier), which exercises a day/slot/week has, block-day maths |
| `performance.ts` | plain per-set value in the movement's unit, best-of comparisons, best by session / week / variant, trend, 4-weeks-ago lookup |
| `scoring.ts` | qualifying-set rule (no flags, no RPE 10), session load, relative load and bodyweight-normalised est. 1RM |
| `analysis.ts` | skill definitions, live stop-rule check, weekly firings, stagnation detector, next progression axis, one-variable rule + override count, tendon guardrails, joint relevance |
| `readiness.ts` | autoregulation adjustment, joint-volume warnings |
| `body.ts` | rolling 7-day weight / kcal / macros, weekly rate (kg and %), corridor status, projected week-12 weight, weekly summaries; v5.1: required rate, straight-line target trajectory, plan variance, corridor/target mismatch flag |
| `coverage.ts` | v5.1: per-week data completeness — prescribed slots vs completed / logged / unknown / upcoming, weight & nutrition day counts, retrospective-entry count |
| `decisions.ts` | v5.1: comparable-sessions-since, follow-up status (waiting / due / recorded), due-follow-up list, weekly decision counts, retrospective flag |
| `review.ts` | weekly review builder, planned sessions per week, phase notes, end-of-block target checks |
| `units.ts`, `format.ts` | kg↔lbs conversion; every number formatted to ≤ 2 dp |

Everything here is a pure function with a vitest test file beside it.

---

## 9. Version history (short)

| Version | Date | Headline |
|---|---|---|
| 1.0.0 | — | Initial 12-week calisthenics + cut block; all screens, engine, stop rules, stagnation detector |
| 1.1.0 | — | AM mobility progression model; kg/lbs display; macros with derived calories |
| 2.0.0 | — | Supabase multi-device sync + email OTP auth |
| 3.0.0 | 2026-08-04 | Monday reprogrammed; unitless Difficulty/Progress indices deleted in favour of real units; every day navigable; real PWA update channel; reset tombstone |
| 4.0.0 | 2026-08-27 | Marathon-hybrid block: 5–6 runs/week, three full-body days, third `later` slot, run-interval metric, three RPE scales, Achilles in readiness, 66 exercises retired |
| 5.0.0 | 2026-09-12 | Calisthenics-priority cut on push/pull/legs, three cardio sessions, one deload (week 6), six phases, cardio targets, 24 exercises retired, schema v6 |
| 5.1.0 | 2026-09-12 | Current: analytics case-study layer — decision journal with evidence snapshots and follow-ups, versioned case-study protocol, data-coverage and decisions cards in Review, target-trajectory "vs plan" stat, absolute + relative 1RM estimates, analysis-pack export (tidy CSVs + manifest + data dictionary), demo-data provenance flag, schema v7. Training plan unchanged. |

See `CHANGELOG.md` for the full detail and `SPEC-V5.0.md` for the current authoritative spec.

---

## 10. The analytics case-study layer (v5.1)

Block 12 doubles as an applied business-intelligence project — a single-person
longitudinal observational case study ("Block 12: Applying Business Intelligence to
Personal Training Decisions"). The v5.1 layer exists to make its evidence defensible,
and it deliberately does NOT change the training plan, add prediction, or make causal
claims:

- **Protocol before results.** The case-study protocol fixes the question, anchor
  exercises, baseline/endpoint windows and missing-data rules, and records how much
  data already existed when it was created. A protocol written mid-block is labelled
  retrospective — never presented as preregistration.
- **Decisions are data.** The journal captures the recommendation as shown (with its
  rule version), the evidence visible at the time (frozen), the decision, the action,
  and a pre-stated follow-up window. "Followed", "rated useful" and "followed by
  improvement" remain separate facts; none is treated as proof of effectiveness.
- **Honest denominators.** Coverage reporting distinguishes not prescribed, completed,
  logged and unknown; missing observations are excluded, never zero-filled or
  estimated; retrospective entries are counted; deloads are prescribed reductions,
  not deterioration.
- **Reproducibility.** The analysis pack exports tidy per-grain CSVs with a manifest
  and data dictionary so every headline figure can be recomputed outside the app
  (Tableau / Python / SQL). The external dashboard is a learning deliverable built
  from these exports — no BI tooling is embedded in the PWA.
- **Provenance.** Demo-seeded state is stamped and surfaced in the manifest so
  synthetic data can never quietly enter genuine results. Ladder variant ids,
  exercise ids and retired-exercise records keep historical identity stable.
