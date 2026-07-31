# Block 12

Single-user, offline-first PWA that runs a fixed 12-week calisthenics + cut block.

The full specification lives in [SPEC.md](./SPEC.md), amended by
[SPEC-V1.1.md](./SPEC-V1.1.md). Together they are authoritative for program
content, engine behavior, and screens; where they conflict, the amendment wins.
Project rules for working in this codebase are in [CLAUDE.md](./CLAUDE.md).

## Data

No backend, no auth, no network calls at runtime. All state lives in
`localStorage` under the key `block12:v1`.

## Commands

```
npm run dev         # start dev server
npm run build        # typecheck + production build
npm run test         # run vitest suite
npm run typecheck    # tsc --noEmit
npm run lint          # oxlint
```

## Structure

- `src/domain/` — pure functions for all metric math (phase resolution, scoring,
  difficulty, readiness, review), covered by vitest.
- `src/data/` — program content (exercises, ladders, mobility, targets). Never
  hardcode a prescription elsewhere.
- `src/screens/` — Today, Program, Body, Progress, Review, Session Runner, Settings.
- `src/store/` — zustand store and localStorage persistence.
- `src/components/` — presentational components; they read domain results, never
  compute them.
