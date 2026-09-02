# BLOCK 12 — project rules

Single-user, offline-first PWA that runs a fixed 12-week hybrid marathon +
calisthenics + cut block.

The specification is in **./SPEC.md** plus its amendments **./SPEC-V1.1.md**,
**./SPEC-V2.0.md**, **./SPEC-V3.0.md** and **./SPEC-V4.0.md**. All five are
authoritative and must be read together. Where they conflict, the newest amendment
wins — V4.0 over V3.0 over V2.0 over V1.1 over SPEC.md. Each amendment's own §1 lists
every line it supersedes. If code and spec disagree, the spec wins; if the spec is
ambiguous, ask before inventing.

**./12_week_hybrid_marathon_calisthenics_plan.md** is the transcription source for all
v4.0 training content. Where SPEC-V4.0.md paraphrases it, that document wins.

Current version: 4.0.0 shipped (tag `v4.0.0`) — the block rebuilt around marathon
training: three full-body days, five to six runs a week, grease-the-groove skill work
in place of daily mobility, two flexibility sessions, and three loading waves
deloading at weeks 4, 8 and 12. See SPEC-V4.0.md and CHANGELOG.md.

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
- Never invent training prescriptions, exercise names, or RPE targets. Transcribe
  12_week_hybrid_marathon_calisthenics_plan.md exactly — one Prescription per table row,
  except where the plan itself groups weeks ("Weeks 1–2", "normal weeks / weeks 4, 8, 12").
- There are THREE blocks per day: `am` (grease the groove, Mon/Wed/Fri), `main`, and
  `later` (flexibility Tue/Sun, recovery run Wed). Session ids stay `${date}:${block}`.
  A day hides any slot it prescribes nothing for.
- `sets: 0` means "not prescribed this week" and `exercisesFor` drops it. It must be
  authored EXPLICITLY — `resolvePrescription`'s nearest-earlier fallback will otherwise
  fill the gap with a neighbouring week's numbers. See SPEC-V4.0.md §4.
- Grease-the-groove blocks are prescribed in ROUNDS of the whole list, not sets of each
  item, so `sets` is the round count and `setsLabel: 'rounds'` makes the UI say so.
- Three RPE scales, and they do not share bounds: `strength` 6–10, `stretch` 5–8,
  `run` 1–10. Set `Exercise.rpeScale`; the stepper and the stop rules both read it.
  The RPE-10 and week-cap stop rules apply to the strength scale only.
- The RPE ceiling is `weekRpeCap(week)` in phase.ts — the highest RPE the plan itself
  prescribes that week. Do not re-derive it from a phase name.
- Ladders: a variant `id` is NEVER renamed or removed (it is stored in SetLog.variantId).
  `level` and array order carry no stored data and may be rebuilt freely.
- No unitless numbers in the UI. The Difficulty Index and Exercise Progress Index were
  deleted in v3.0 — every displayed figure is in the movement's own unit (reps, seconds,
  kg, cm). Variant difficulty is a GROUPING key (src/domain/performance.ts's
  bestByVariant), never a coefficient. Do not reintroduce a scoring multiplier.
- Nothing rendered anywhere exceeds 2 decimal places. Route every displayed number
  through src/domain/format.ts, and chart data/tooltips through
  src/components/chartFormat.ts — recharts prints whatever float it is handed.
- Retiring an exercise: move its record verbatim into src/data/retiredExercises.ts,
  never delete it and never rewrite a historical `exerciseId`. Resolve ids that came
  from a LOG via `lookupExercise`; build PRESCRIPTION lists from `program` directly.
  Check whether SKILLS, review.ts's week-12 targets, or demoSeed name the retired id.
  An exercise that carries over as the SAME movement in the same role keeps its id
  instead, so its chart stays continuous — `ring-dip`, `ring-pullup` and `fl-raise` do.
- analysis.ts's ELBOW/SHOULDER/ACHILLES id sets keep retired ids alongside current ones:
  joint warnings read historical logs, and an old session loaded the same joint.
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
