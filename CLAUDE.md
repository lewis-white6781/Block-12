# BLOCK 12 — project rules

Single-user, offline-first PWA that runs a fixed 12-week calisthenics + cut block.

The specification is in **./SPEC.md** plus its amendments **./SPEC-V1.1.md** and
**./SPEC-V2.0.md**. All three are authoritative and must be read together. Where they
conflict, the newest amendment wins — SPEC-V2.0.md over SPEC-V1.1.md over SPEC.md.
Each amendment's own §1 lists every line it supersedes. If code and spec disagree, the
spec wins; if the spec is ambiguous, ask before inventing.

Current version: 2.1.0 shipped (tag `v2.1.0`) — bundles the sync/auth/deploy work
documented in SPEC-V2.0.md with a UI-consistency pass and the reset-and-restart
feature. See CHANGELOG.md.

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
- Never invent training prescriptions, exercise names, or RPE targets. Copy SPEC.md exactly.
  AM exercises are `tracked: true` as of v1.1, but their prescriptions stay exactly as
  transcribed — AM progression comes from logged performance, not new programming.
  See SPEC-V1.1.md §2.
- Weights are kg-native everywhere in src/domain/ and in stored/exported data.
  kg/lbs is a display-and-entry concern only. See SPEC-V1.1.md §3.
- Never change the localStorage key. Bump `SCHEMA_VERSION` and write a real migration
  instead; zustand's persist merges shallowly, so new fields need defaults spread in.
- Run `npm run build` (not just `npx tsc --noEmit`, which misses errors `tsc -b`'s
  project-references mode catches — e.g. mismatched JSX closing tags) and
  `npx vitest run` before saying a step is done.
- Commit after each numbered step with a conventional-commit message.

## Commands
npm run dev · npm run build · npm run test · npm run typecheck
