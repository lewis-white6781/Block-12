# BLOCK 12 — SPEC AMENDMENT v6.1

**Status:** authoritative amendment to `SPEC.md` through `SPEC-V6.0.md`.
**Baseline:** v6.0.0.

This file makes the **variant and assistance a per-set choice** in the Session
Runner and adjusts the analysis that assumed one variant per session. The data
model, storage key, schema version, sync and programme content are unchanged.

---

## 0. Why this amendment exists

The athlete mixes progressions within one exercise — e.g. front lever set 1
straddle, set 2 one-leg, set 3 tuck. `SetLog.variantId` and
`SetLog.assistanceTier` have always been stored per set, but the Runner showed
one exercise-level picker, never displayed which variant a logged set used, and
parts of the analysis read a session as if it had one variant.

---

## 1. Amendments to the earlier specs

| Spec | Line | Change |
|---|---|---|
| SPEC.md §7.2 | "Variant: — · Assistance: none" row above the sets | Moves into the active set card (§2). |
| SPEC-V4.0.md §7 | Performance Drop Rule baseline = first set of the session | First set **at the same variant and assistance** (§4). |
| SPEC-V3.0.md §2 | `bestByVariant` fed by one best per session | Fed by every qualifying set (§3). |
| SPEC-V3.0.md §2 / SPEC.md §6.7 | Trend, session best and stagnation read every set | Read only the session's hardest-variant sets (§3). |

---

## 2. Session Runner

- The Variant and Assistance pickers sit inside the active SET card. Each new
  set starts from the previous set logged this session, else the last set of
  the previous session, so keeping the same variant costs no taps.
- Every logged set row shows its variant (and assistance tier when not
  "none"). Tapping a logged row opens the pickers for that set, written via the
  store action `updateSetVariant` (stamps the session's `updatedAt` for sync).
- "Last time" lists each set with its own variant: `5s straddle, 8s one-leg,
  15s tuck`.

## 3. One number per session — hardest variant

`hardestVariantSets` (src/domain/performance.ts) keeps only the sets at the
highest ladder `level` used in the session, tie-broken by the lowest assistance
tier. The variant is chosen from qualifying sets (falling back to all sets if
none qualify). Sets with no variant rank below every ladder variant; sessions
that recorded none are unchanged.

- `bestBySession` (default `scope: 'hardest'`) and `buildPlainHistory` apply
  it, so the trend arrow, headline best and stagnation detector are not
  inflated by easier back-off sets.
- `bestBySession(..., 'all')` is used by the end-of-block target check, whose
  targets accept any of several variants.
- `bestByVariant` is fed `qualifyingSetBests` (one entry per set) so every
  variant trained in a session keeps its own best.

## 4. Stop rule

The 15% drop compares a set with `firstSameVariantSet` — the earliest set this
session at the same variant and assistance. The first set at a variant has no
baseline. Review's `weeklyStopRuleFirings` uses the same helper.

## 5. Data

No schema change; `SCHEMA_VERSION` stays 8. Existing sets keep the variant they
were logged with.
