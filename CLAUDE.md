# BLOCK 12 — project rules

Single-user, offline-first PWA that runs a fixed 12-week calisthenics + cut block.
The full specification is in ./SPEC.md. It is authoritative. If code and spec
disagree, the spec wins; if the spec is ambiguous, ask before inventing.

## Rules
- No backend, no auth, no network calls at runtime. localStorage only, key `block12:v1`.
- TypeScript strict. No `any` in src/domain/.
- All metric maths lives in src/domain/ as pure functions with vitest tests.
  Components read results, never compute them.
- All program content lives in src/data/program.ts. Never hardcode a prescription in JSX.
- Mobile-first, 380px, one-handed, tap targets >= 44px. Dark theme from src/styles/tokens.css.
- Never invent training prescriptions, exercise names, or RPE targets. Copy SPEC.md exactly.
- Run `npx tsc --noEmit` and `npx vitest run` before saying a step is done.
- Commit after each numbered step with a conventional-commit message.

## Commands
npm run dev · npm run build · npm run test · npm run typecheck
