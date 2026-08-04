# Block 12

Single-user, offline-first PWA that runs a fixed 12-week calisthenics + cut block.

The full specification lives in [SPEC.md](./SPEC.md), amended by
[SPEC-V1.1.md](./SPEC-V1.1.md), [SPEC-V2.0.md](./SPEC-V2.0.md) and
[SPEC-V3.0.md](./SPEC-V3.0.md). Together they are authoritative for program
content, engine behavior, and screens; where they conflict, the newest
amendment wins. Each amendment's own §1 lists every line it supersedes.
Project rules for working in this codebase are in [CLAUDE.md](./CLAUDE.md).

Current version: **3.0.0**. See [CHANGELOG.md](./CHANGELOG.md).

## Data

`localStorage` under the key `block12:v1` is the source of truth for all reads
and writes, so the app works fully offline. On top of that, a single-user
Supabase account mirrors that state across devices — phone and laptop see the
same training history.

- **Sync** is periodic and event-triggered (~30s, on foreground, on reconnect,
  on local write, on finishing a session, or manually). No realtime
  subscriptions. Merge is last-write-wins per record; see SPEC-V2.0.md §2 and
  SPEC-V3.0.md §6.
- **Auth** is email OTP locked to one allow-listed address (in practice
  sign-in-by-link; SPEC-V2.0.md §4).
- Only the Supabase **anon/public** key is ever used client-side, via
  `VITE_SUPABASE_ANON_KEY`. Copy `.env.example` to `.env` to run locally.
- Weights are **kg-native** everywhere in the domain and in all stored and
  exported data; kg/lbs is display and entry only (SPEC-V1.1.md §3).

## Updates

Deployed builds reach installed devices on their own. The service worker is
built from `public/sw.template.js` by `scripts/build-sw.mjs`, stamped with a
cache version derived from the built output, so each deploy is detected as a
genuine worker update. The page checks on foreground, on reconnect and every 15
minutes, then swaps in the new build when it is safe — visible, and not inside
a running session — after flushing local writes to Supabase first. Nothing is
lost and no reload lands mid-set. Settings' About card shows the running
version and build id.

## Commands

```
npm run dev          # start dev server
npm run build        # typecheck + production build + emit dist/sw.js
npm run test         # run vitest suite
npm run typecheck    # tsc -b --noEmit
npm run lint         # oxlint
```

Run `npm run build` rather than `npx tsc --noEmit` before calling a change
done: the project-references build catches errors `--noEmit` alone misses.

## Structure

- `src/domain/` — pure functions for all metric math (phase resolution,
  performance bests, analysis, readiness, body/corridor, review, formatting),
  covered by vitest. Components read results, never compute them.
- `src/data/` — program content (exercises, ladders, mobility, targets) plus
  `retiredExercises.ts` for exercises no longer prescribed but still present in
  historical logs. Never hardcode a prescription elsewhere.
- `src/screens/` — Today, Program, Body, Progress, Review, Session Runner, Settings.
- `src/store/` — zustand store, localStorage persistence, schema migrations.
- `src/sync/` — Supabase pull/merge/push. Kept separate from `src/domain/`'s
  pure metric maths; do not mix them.
- `src/pwa/` — service-worker registration, update detection, and the
  swap-when-safe decision.
- `src/hooks/` — `useToday`, the live current date.
- `src/components/` — presentational components.
- `src/lib/` — the Supabase client.
