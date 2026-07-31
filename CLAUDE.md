# BLOCK 12 — project rules

Single-user, offline-first PWA that runs a fixed 12-week calisthenics + cut block.

The specification is in **./SPEC.md** plus its amendment **./SPEC-V1.1.md**. Both are
authoritative and must be read together. Where they conflict, SPEC-V1.1.md wins — it
exists precisely to record the places v1.1 deliberately departs from SPEC.md, and its
§1 lists every superseded line. If code and spec disagree, the spec wins; if the spec
is ambiguous, ask before inventing.

Current version: 1.0.0 shipped (tag `v1.0.0`); 1.1 in progress per SPEC-V1.1.md §4.

## Rules
- No backend, no auth, no network calls at runtime. localStorage only, key `block12:v1`.
- TypeScript strict. No `any` in src/domain/.
- All metric maths lives in src/domain/ as pure functions with vitest tests.
  Components read results, never compute them.
- All program content lives in src/data/program.ts. Never hardcode a prescription in JSX.
- Mobile-first, 380px, one-handed, tap targets >= 44px. Dark theme from src/styles/tokens.css.
- Never invent training prescriptions, exercise names, or RPE targets. Copy SPEC.md exactly.
  AM exercises are `tracked: true` as of v1.1, but their prescriptions stay exactly as
  transcribed — AM progression comes from logged performance, not new programming.
  See SPEC-V1.1.md §2.
- Weights are kg-native everywhere in src/domain/ and in stored/exported data.
  kg/lbs is a display-and-entry concern only. See SPEC-V1.1.md §3.
- Never change the localStorage key. Bump `SCHEMA_VERSION` and write a real migration
  instead; zustand's persist merges shallowly, so new fields need defaults spread in.
- Run `npx tsc --noEmit` and `npx vitest run` before saying a step is done.
- Commit after each numbered step with a conventional-commit message.

## Commands
npm run dev · npm run build · npm run test · npm run typecheck
