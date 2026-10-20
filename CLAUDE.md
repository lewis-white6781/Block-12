# BLOCK 12 — project rules

Single-user, offline-first PWA that runs a fixed 12-week block. The current
block is **Cut to New Year**: Upper A / Rest / Football / Upper B / Football /
Mobility + Core / Lower, with a bodyweight-keyed nutrition table.

The specification is in **./SPEC.md** plus its amendments **./SPEC-V1.1.md**,
**./SPEC-V2.0.md**, **./SPEC-V3.0.md**, **./SPEC-V4.0.md**, **./SPEC-V5.0.md**,
**./SPEC-V6.0.md** and **./SPEC-V6.1.md**. All eight are authoritative and must be
read together. Where they conflict, the newest amendment wins — V6.1 over V6.0 over
V5.0 over V4.0 over V3.0 over V2.0 over V1.1 over SPEC.md. Each amendment's own §1 lists every line it
supersedes. If code and spec disagree, the spec wins; if the spec is ambiguous,
ask before inventing.

**./cut-to-new-year-training-nutrition.md** is the transcription source for all
v6.0 training and nutrition content. Where SPEC-V6.0.md paraphrases it, that
document wins. (./updatedblock20.md and
./12_week_hybrid_marathon_calisthenics_plan.md stay in the repo for the retired
records' provenance only.)

Current version: 6.1.0 — the Cut to New Year block, day 1 Sunday 11 Oct 2026.
Gym sessions all sit in the `main` slot; handstand + mobility (daily) and football
(Wed/Fri) are tick boxes on `DailyEntry.checks`; nutrition targets come from
src/data/nutrition.ts with a weekly calorie check in src/domain/nutrition.ts.
Schema v8 wiped the previous block. See SPEC-V6.0.md and CHANGELOG.md.

## Rules
- Sync: Supabase (Postgres + Auth). Periodic/event-triggered sync only (~30s interval,
  on foreground, on reconnect, on local write, or manual) — no realtime subscriptions.
  Auth is email OTP (sign-in-by-link in practice; see SPEC-V2.0.md §4) locked to one
  allow-listed address. Never store the Supabase *service-role* key client-side — only
  the anon/public key, via VITE_SUPABASE_ANON_KEY. localStorage remains the source of
  truth for offline reads/writes; key stays block12:v1. See SPEC-V2.0.md.
- Sync code (src/sync/) is a separate concern from src/domain/'s pure metric maths —
  do not mix them.
- TypeScript strict. No `any` in src/domain/.
- All metric maths lives in src/domain/ as pure functions with vitest tests.
  Components read results, never compute them.
- All program content lives in src/data/program.ts. Never hardcode a prescription in JSX.
- Mobile-first, 380px, one-handed, tap targets >= 44px. Dark theme from src/styles/tokens.css.
- Never invent training prescriptions, exercise names, RPE targets or nutrition
  numbers. Transcribe cut-to-new-year-training-nutrition.md exactly.
- There are THREE block slots per day (`am`, `main`, `later`); v6.0 uses only `main`
  (Mon, Thu, Sat, Sun). Session ids stay `${date}:${block}`. A day hides any slot it
  prescribes nothing for — Tue/Wed/Fri have NO gym session. Never assume every day
  has a main.
- Tick-box habits (handstand + mobility, football) are `dailyChecks` in program.ts,
  stored on `DailyEntry.checks`. A check `id` is stored data — never rename it.
- `sets: 0` means "not prescribed this week" and `exercisesFor` drops it. It must be
  authored EXPLICITLY — `resolvePrescription`'s nearest-earlier fallback will otherwise
  fill the gap with a neighbouring week's numbers. v6.0 uses it for every non-floor
  exercise in the Christmas weeks 11–12. See SPEC-V4.0.md §4.
- A range on a field the type stores as ONE number (`sets`, `minutesEach`) takes the
  HIGH end and records the range in `note` ("4–5 sets", "3–4 sets"). Reps, seconds
  and RPE ranges are native. See SPEC-V6.0.md §4.
- The plan's one "Sets by phase" table is authored ONCE, as the `star()` and `other()`
  builders in program.ts. Never retype a weekly table per exercise.
- `setsLabel: 'rounds'` (GTG rounds) is unused in v6.0; the mechanism stays.
- Three RPE scales, and they do not share bounds: `strength` 6–10, `stretch` 5–8,
  `run` 1–10. Set `Exercise.rpeScale`; the stepper and the stop rules both read it.
  The RPE-10 and week-cap stop rules apply to the strength scale only.
- The RPE ceiling is `weekRpeCap(week)` in phase.ts — the highest RPE the plan itself
  prescribes that week, or `null` where it prescribes none (Christmas). RPE 10 only
  warns where the cap is below 10. Do not re-derive it from a phase name.
- Nutrition: the table lives in src/data/nutrition.ts and is never edited to apply a
  change. Rules 3/4 are dated `Settings.nutritionAdjustments`, through carbs only. All
  nutrition maths is in src/domain/nutrition.ts.
- Ladders: a variant `id` is NEVER renamed or removed (it is stored in SetLog.variantId).
  `level` and array order carry no stored data and may be rebuilt freely.
- Variant + assistance are chosen PER SET (SPEC-V6.1.md). Anything needing one
  number per session reads `hardestVariantSets`; the drop rule compares against
  `firstSameVariantSet`; `bestByVariant` takes `qualifyingSetBests`.
- No unitless numbers in the UI. The Difficulty Index and Exercise Progress Index were
  deleted in v3.0 — every displayed figure is in the movement's own unit (reps, seconds,
  kg, cm). Variant difficulty is a GROUPING key (src/domain/performance.ts's
  bestByVariant), never a coefficient. Do not reintroduce a scoring multiplier.
- Nothing rendered anywhere exceeds 2 decimal places. Route every displayed number
  through src/domain/format.ts, and chart data/tooltips through
  src/components/chartFormat.ts — recharts prints whatever float it is handed.
- Retiring an exercise: move its record verbatim into src/data/retiredExercises.ts,
  never delete it and never rewrite a historical `exerciseId`. If the record was
  authored against a helper (a shared table, `gtgPrescriptions`), freeze that helper
  in retiredExercises.ts too — the v4.0 helpers already live there. Resolve ids that
  came from a LOG via `lookupExercise`; build PRESCRIPTION lists from `program`
  directly. Check whether SKILLS, review.ts's week-12 targets, or demoSeed name the
  retired id. An exercise that carries over as the SAME movement in the same role
  keeps its id even if its day moves, so its chart stays continuous — 24 did in v6.0
  (src/data/retiredV5.ts). A retired id can never be reused: `ring-curl-b` and
  `hanging-leg-raise-slow` exist because the plain ids were already retired.
- analysis.ts's ELBOW/SHOULDER/ACHILLES id sets keep retired ids alongside current ones:
  joint warnings read historical logs, and an old session loaded the same joint.
- Phase is a pure function of week (`phaseForWeek`). When the phase names change,
  bump `SCHEMA_VERSION` and recompute every stored `SessionLog.phase` in the
  migration — v5, v6 and v8 all do this. Never leave a stored phase that is not a
  member of the current `Phase` union.
- `migrate()` runs on every pulled REMOTE blob too. A migration that drops data must
  be deterministic (fixed cutoffs, never "now") so every device strips the same
  records — see `migrateToV8` and SPEC-V6.0.md §8.
- The service worker is generated: edit public/sw.template.js, never dist/sw.js, and
  never hardcode a CACHE_VERSION. It must not call skipWaiting() on install — the page
  decides when to swap so an update never lands mid-session. See SPEC-V3.0.md §5.
- Weights are kg-native everywhere in src/domain/ and in stored/exported data.
  kg/lbs is a display-and-entry concern only. See SPEC-V1.1.md §3.
- Never change the localStorage key. Bump `SCHEMA_VERSION` and write a real migration
  instead; zustand's persist merges shallowly, so new fields need defaults spread in.
- Run `npm run build` (not just `npx tsc --noEmit`, which misses errors `tsc -b`'s
  project-references mode catches — e.g. mismatched JSX closing tags) and
  `npx vitest run` before saying a step is done.
- Commit after each numbered step with a conventional-commit message.

## Commands
npm run dev · npm run build · npm run test · npm run typecheck · npm run lint

`npm run build` also emits dist/sw.js via scripts/build-sw.mjs.
