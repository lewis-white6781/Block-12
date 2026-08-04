# BLOCK 12 — SPEC AMENDMENT v2.0

**Status:** authoritative amendment to `SPEC.md` and `SPEC-V1.1.md`.
**Baseline:** v1.1.2 (tag `v1.1.2`), the shipped v1.1 build plus its one
post-ship bug fix.

This file does **not** replace `SPEC.md` or `SPEC-V1.1.md`. Where this file
conflicts with either, **this file wins**, and the conflicting line is
listed in §1 below so the disagreement is explicit rather than accidental.

Read this file together with `SPEC.md` and `SPEC-V1.1.md` before touching
sync, auth, or deployment code.

*Note on timing:* this amendment documents the sync/auth/deploy work as it
was actually built and shipped — it is written and committed at the same
time as the v2.1 release (tag `v2.1.0`), not v2.0 in isolation. The two
were built back to back and shipped together; this file exists so the
architecture decision is recorded formally, per this project's own
governance model, rather than left implicit in commit history.

---

## 0. Why this amendment exists

`CLAUDE.md` and `SPEC.md` §1/§2 state, as a **deliberate design decision**,
not an oversight: single-user, no auth, no accounts, no backend, no network
calls at runtime, localStorage only. That decision made sense for a phone
used in one home gym. It stopped making sense once the same person wanted
to log a set on their phone at the gym and see it on their laptop that
evening — two devices, one person, one training history.

| # | Problem | Nature |
|---|---|---|
| 1 | Training data lives in one browser's localStorage only; a second device sees nothing | **spec change** — reverses SPEC.md §1/§2's explicit single-device, no-backend stance |
| 2 | No way to reach the app at a permanent, memorable URL from a second device | spec silent — "deploy" was a single unspecified line item in SPEC.md §9 |

This is not spec-silent-filled-in-by-convention, the way v1.1's day
navigation was. It is a direct, acknowledged reversal of an explicit rule,
so — matching how SPEC-V1.1.md §1 handled the AM-tracking reversal — every
superseded line is listed below rather than quietly coded around.

---

## 1. Amendments to SPEC.md and SPEC-V1.1.md

| Source | Says | v2.0 replacement | Why |
|---|---|---|---|
| `SPEC.md` §1 | "**User:** one person (the owner). No auth, no accounts, no multi-user." | One person, one allow-listed account (Supabase email OTP), used from two or more trusted devices syncing the same data. Still single-tenant in the sense that matters — no sharing, no other users can ever see this data. | Two devices, one training history. |
| `SPEC.md` §1 | "**Primary device:** phone, in a home gym, possibly offline. Desktop is secondary (used for review, not logging)." | Both devices are equally first-class; either can log, either can review. | The phone/laptop split this line assumed no longer holds. |
| `SPEC.md` §1 | Non-goals list "backend/API, login" | Both are now in scope, narrowly: a single-table Supabase backend (§3 below) and an email-OTP login gated to one allow-listed address. Everything else in the non-goals line stands (no social features, no exercise video library, no AI coach chat, no food database, no Health/Strava sync). | Narrowest possible reversal — one table, one user. |
| `SPEC.md` §2 | "**No backend. No network calls at runtime.** Everything in `localStorage` under a single versioned key." | Network calls now happen: on sign-in, and on periodic/event-triggered sync (~30s interval, on app foreground, on reconnect, on local write, or manual "Sync now"). No realtime subscriptions — see §2 below for why. `localStorage` remains the source of truth for offline reads and writes; sync is a background mirror, never a blocking dependency. | See §2. |
| `SPEC.md` §2 | "Storage key: `block12:v1`... `schemaVersion`... `migrate()`..." | Unchanged in substance. `STORAGE_KEY` stays `block12:v1`. This amendment adds `SCHEMA_VERSION 3` as one more migration step using the exact same mechanism, not a new one. | The existing versioning contract already does what sync needs. |
| `CLAUDE.md` | "No backend, no auth, no network calls at runtime. localStorage only, key `block12:v1`." | Superseded by this amendment. See the updated `CLAUDE.md` rules list. | — |

Everything else in `SPEC.md` and `SPEC-V1.1.md` stands unchanged — in
particular the training content in `SPEC.md` §5, the analysis engine in
§6, and the AM progression model in `SPEC-V1.1.md` §2, none of which this
amendment touches.

---

## 2. The sync/merge architecture

**Why periodic + event-triggered, not realtime.** Supabase Realtime
(websocket subscriptions) would push a change from one open device to
another instantly. That solves a problem this app doesn't really have —
one person is rarely editing the same block from two open tabs at the same
moment. What actually happens is: log a session at the gym on the phone,
close the app, open the laptop that evening. A ~30-second interval plus
triggers on app-foreground, reconnect, and local-write are more than
sufficient for that pattern, with far less to build and far fewer failure
modes than managing a websocket connection's lifecycle, reconnection, and
auth-refresh interplay.

**Why OTP, not magic-link.** The app uses `HashRouter` (`SPEC.md` §2: "Hash
router — makes static hosting trivial"). A magic-link sign-in redirects
back with an implicit-flow `#access_token=...` fragment, which collides
head-on with `HashRouter`'s own use of `location.hash` for routing — the
router would try to interpret the token string as a route. `src/main.tsx`
works around this (see §3), but a typed one-time code sidesteps the
problem at its root: no redirect, no fragment, nothing for the router to
misinterpret.

**The merge model.** `src/sync/merge.ts` exports one pure function,
`mergeState(local, remote): PersistedState`, doing **last-write-wins per
entity**, not field-level merging within an entity:

- `sessionLogs`, `dailyEntries`, `benchmarkEntries` — keyed by their
  existing natural keys (`${date}:${block}`, `date`, `week`); whichever
  side has the newer `updatedAt` wins for that whole record. A key present
  on only one side survives untouched.
- `settings` — one whole-object comparison by `updatedAt`.
- `progressionEvents` — union by `id`. Safe unconditionally, since these
  records are immutable and append-only once created.

The single sharp edge this model has: two devices editing the **same**
session/entry within one sync window (~30s, or less with the debounced
local-write trigger) will have the later write silently win, discarding
the earlier one's edits to that same record. This is an accepted,
documented limitation (see §6) rather than an unsolved problem — building
field-level or CRDT-style merge for a single-user app editing from two
devices they don't use simultaneously would be solving a problem that
essentially doesn't occur in practice, at real implementation cost.

**Trigger list**, all funneled through one `runSync()` with an in-flight
guard so concurrent calls coalesce rather than race (`src/sync/syncEngine.ts`):
sign-in / app start, a ~2s debounced subscription to local store writes,
`document.visibilitychange`, `window`'s `online` event, and a 30s interval,
plus a manual "Sync now" button in Settings. Network failures at any point
set sync status to `error`/`offline` and are surfaced in Settings — they
never throw into the caller and never clear local state. Local writes
always persist to `localStorage` synchronously via the existing zustand
`persist` middleware regardless of sync's health; the next successful sync
reconciles whatever changed while it was down.

---

## 3. Data model deltas

Amends `SPEC.md` §4 and `SPEC-V1.1.md` §3. Additive only.

```ts
export interface SessionLog {
  // ...all existing fields unchanged...
  updatedAt: string; // NEW — ISO timestamp, bumped on every set logged or session change
}

export interface DailyEntry {
  // ...all existing fields unchanged...
  updatedAt: string; // NEW
}

export interface BenchmarkEntry {
  // ...all existing fields unchanged...
  updatedAt: string; // NEW
}

export interface Settings {
  // ...all existing fields unchanged...
  updatedAt: string; // NEW — whole-object timestamp, bumped on any settings change
}
```

`ProgressionEvent` gets no `updatedAt` — immutable and append-only, so
union-by-`id` needs no timestamp to resolve conflicts (there are none).

**`benchmarkEntries` changes shape**, from `BenchmarkEntry[]` to
`Record<string, BenchmarkEntry>` keyed by `String(week)`. The pre-existing
`upsertBenchmarkEntry` reducer already deduped by week (filter-then-append
against the array), so this makes explicit what was already true
conceptually, and gives it the same clean per-key merge semantics as
`sessionLogs`/`dailyEntries`.

**Storage.** `STORAGE_KEY` remains `block12:v1`. `SCHEMA_VERSION` goes to
`3` with a real `migrateToV3`, chained after the existing `migrateToV2`:
sessions backfill `updatedAt` from `completedAt ?? startedAt ?? now`;
daily entries and benchmarks (which have no natural event timestamp)
backfill from noon on their own `date` — deterministic, and avoids every
historical record collapsing onto the exact migration instant, which
would make old data look artificially "freshest" if a second device
migrates later; settings backfills to `now`. A straight v1→v3 jump also
converts a still-array-shaped `benchmarkEntries` to the new map in the
same pass.

**Supabase schema** (`supabase/schema.sql`, checked in, run manually by
the project owner against their own Supabase project — Claude Code cannot
provision cloud infrastructure): one `block_state` table, one row per
authenticated user, columns mirroring `PersistedState` as JSONB
(`settings`, `daily_entries`, `session_logs`, `benchmark_entries`,
`progression_events`), plus `schema_version` and `updated_at`. Row-level
security restricts every operation to `auth.uid() = user_id`.

---

## 4. What shipped (in lieu of a forward-looking prompt pack)

Unlike v1.0 and v1.1, this amendment is written after the work landed, not
before, so there is no prospective prompt pack — the sequence that was
actually run, for the record:

1. Data model foundations — `updatedAt` fields, `SCHEMA_VERSION` 3,
   `benchmarkEntries` array→map, migration, reducer stamping.
2. Merge engine — `src/sync/merge.ts`, pure, unit-tested independently of
   Supabase/React/zustand.
3. Supabase schema — `supabase/schema.sql`, RLS policies (manual step:
   created and run by the project owner).
4. Supabase client — `src/lib/supabaseClient.ts`, env-var wiring,
   `.env.example`, `.gitignore` updated.
5. Auth gate — `src/screens/Auth.tsx` wrapping `App.tsx`'s router;
   `src/main.tsx`'s `bootstrap()` gate (see below).
6. Sync engine — `src/sync/syncEngine.ts`, `src/sync/syncStore.ts`, the
   five triggers.
7. Settings UI — sync status section, sign-out, manual sync.
8. Service worker comment audit — no behavior change; confirmed the
   existing cross-origin passthrough already keeps Supabase calls
   uncached.
9. Deployment — Vercel project connected to the GitHub repo, env vars set,
   `vercel.json` SPA rewrite added as insurance.

**One deviation from the original plan, discovered during implementation:**
Supabase's free/default email service cannot have its templates edited
(customizing the OTP template to display `{{ .Token }}` requires custom
SMTP, which requires a third-party provider signup). Rather than add that
dependency, `src/lib/supabaseClient.ts` re-enabled `detectSessionInUrl`,
and `src/main.tsx` added a `bootstrap()` gate: if the URL hash on load
looks like an auth redirect (`access_token`, `type=magiclink`,
`type=recovery`, or `error=`), it waits for Supabase to consume and clear
the hash via `supabase.auth.getSession()` before the React tree — and
`HashRouter` — ever mounts, then rewrites the hash to a clean `/`. This
means sign-in in practice works by tapping the link in the OTP email
rather than typing a code, even though the UI still accepts a typed code
as a fallback for if custom SMTP is ever configured. The architectural
reasoning in §2 (why OTP over magic-link) still holds — this is a
narrower, load-time-only exception to `detectSessionInUrl: false`, not a
reversal of it; `HashRouter` never sees the raw token hash at any point.

---

## 5. Acceptance tests

Continuing the numbering in `SPEC-V1.1.md` §5 (which ended at 50). v2.0/v2.1
is not done until every line here passes, and every test from `SPEC.md`
§10 and `SPEC-V1.1.md` §5 still passes too.

51. Signing in with the allow-listed email and tapping the emailed link
    reaches the normal tab bar; the hash is clean (`/`) afterward, not the
    raw token fragment.
52. Logging a session on device A and opening the app on device B (after
    any sync trigger fires) shows that session.
53. Editing the same daily entry on two devices while both are online
    converges to the later `updatedAt` on both after the next sync.
54. Going offline mid-session, logging sets, then reconnecting syncs those
    sets without data loss.
55. A stale local `block12:v1` (schemaVersion 2, no `updatedAt` anywhere,
    array-shaped `benchmarkEntries`) migrates cleanly to schemaVersion 3
    with sensible backfilled timestamps and a map-shaped `benchmarkEntries`.
56. Signing out and back in on the same device restores the full synced
    block, not a fresh empty one.
57. Settings' "Sync now" button and status line accurately reflect
    syncing/idle/error/offline states.
58. Export/Import JSON still round-trips losslessly and is unaffected by
    sync being present.
59. The app functions fully offline (read + write) with sync silently
    deferred, per the original offline-first promise in `SPEC.md` §2.
60. **SUPERSEDED by `SPEC-V3.0.md` §1 — this test asserted a behaviour the
    code never had.** It read: *"Reset block — start over today" (Settings'
    danger zone, per v2.1) clears local data, restarts the block from this
    week's Monday, and pushes that empty state to the cloud immediately via
    an explicit `runSync()` call — the next background sync does not
    resurrect the deleted block from a stale cloud copy.* The explicit
    `runSync()` is real, but `mergeByKeyLWW` unions keys and had no
    tombstone mechanism, so a second device's stale copy re-added every
    deleted record on its next pull. Fixed in v3.0 via `settings.resetAt`;
    replaced by acceptance test 74.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| RLS misconfiguration exposes one user's data to another | `supabase/schema.sql` is checked in with explicit `auth.uid() = user_id` policies on every operation; no delete policy at all from client code |
| Anon key committed to git | `.env`/`.env.local` in `.gitignore`; only `.env.example` (blank) is checked in; Vercel holds the real values as environment variables |
| Merge races on true concurrent same-key edits | Documented, accepted limitation (§2) — the ~30s+event trigger cadence makes it rare for a single person alternating devices; not solved with CRDT-style merge, which would cost far more than the problem it prevents |
| Supabase free-tier project pausing after inactivity | The 30s/foreground/reconnect triggers keep it warm during any actual use session |
| Migration bugs corrupt a live block on first v2.0/v2.1 load | `migrateToV3` is unit-tested (`persist.test.ts`) before shipping, matching how `migrateToV2` was validated for v1.1; export-before-upgrading remains available as a manual safety net |
| `detectSessionInUrl` re-enabling reintroduces the exact HashRouter collision it was set to `false` to avoid | `main.tsx`'s `bootstrap()` gate runs strictly before the router mounts and only when the hash matches an auth-redirect pattern, so `HashRouter` never sees a raw token hash at any point — verified in acceptance test 51 |
