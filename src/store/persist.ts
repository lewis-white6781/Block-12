// Versioned localStorage persistence — SPEC.md section 2, 4, 7.7.
// Storage key `block12:v1`, with `schemaVersion` and a real migrate() so a schema
// change never wipes a block mid-flight.
import { format, startOfWeek } from 'date-fns';
import { exerciseName } from '../data/exercises';
import { startOfToday, todayISO } from '../domain/clock';
import { rolling7Weight } from '../domain/body';
import { roundTo } from '../domain/format';
import { phaseForWeek } from '../domain/phase';
import { placeholderSetScore } from '../domain/scoring';
import type {
  BenchmarkEntry,
  CaseStudyProtocol,
  DailyEntry,
  DecisionEntry,
  ProgressionEvent,
  SessionLog,
  Settings,
} from '../domain/types';

export const STORAGE_KEY = 'block12:v1';
export const SCHEMA_VERSION = 8;

/**
 * v6.0 — the Cut to New Year block (SPEC-V6.0.md section 8). Day 1 is Sunday
 * 11 October 2026, and everything recorded under the previous block is wiped.
 *
 * The wipe is a FIXED cutoff rather than "now" because migrate() also runs on
 * every pulled remote blob: a device still on the v5 build can merge its old
 * records back into the cloud copy (labelled schema 7), and the next v6 pull
 * must strip exactly the same records again. A per-device "now" would differ
 * between devices and tombstone each other's new-block data.
 */
export const V6_BLOCK_START = '2026-10-11';
export const V6_WIPE_CUTOFF = '2026-10-11T19:55:00.000Z';

export interface PersistedState {
  schemaVersion: number;
  settings: Settings;
  dailyEntries: Record<string, DailyEntry>;
  sessionLogs: Record<string, SessionLog>;
  benchmarkEntries: Record<string, BenchmarkEntry>;
  progressionEvents: ProgressionEvent[];
  decisionEntries: Record<string, DecisionEntry>;
  caseStudyProtocol: CaseStudyProtocol | null;
}

export function defaultSettings(): Settings {
  return {
    blockStartDate: format(startOfWeek(startOfToday(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    startWeightKg: 80,
    targetWeightKg: 73,
    proteinTargetLow: 170,
    proteinTargetHigh: 190,
    units: 'metric',
    weightUnit: 'kg',
    updatedAt: new Date().toISOString(),
  };
}

export function defaultPersistedState(): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    dailyEntries: {},
    sessionLogs: {},
    benchmarkEntries: {},
    progressionEvents: [],
    decisionEntries: {},
    caseStudyProtocol: null,
  };
}

/** Shape of anything that might arrive from an older export or an older localStorage write. */
type LegacyPersistedState = Partial<Omit<PersistedState, 'settings'>> & {
  settings?: Partial<Settings>;
};

/**
 * v1 -> v2: fills in any missing top-level collections. v1 and v2 share the
 * same Settings shape, so there is nothing settings-specific to do here yet —
 * that is handled unconditionally below, for every version, on every call.
 */
function migrateToV2(state: LegacyPersistedState): LegacyPersistedState {
  return {
    ...state,
    dailyEntries: state.dailyEntries ?? {},
    sessionLogs: state.sessionLogs ?? {},
    // benchmarkEntries left as-is (array or missing) — migrateToV3 normalizes it to a map.
    progressionEvents: state.progressionEvents ?? [],
  };
}

/**
 * v2 -> v3: add updatedAt timestamps to SessionLog, DailyEntry, BenchmarkEntry, Settings.
 * Convert benchmarkEntries from array to Record<string, BenchmarkEntry> keyed by String(week).
 */
function migrateToV3(state: LegacyPersistedState): LegacyPersistedState {
  const now = new Date().toISOString();

  const sessionLogs = Object.fromEntries(
    Object.entries((state.sessionLogs as Record<string, any>) ?? {}).map(([id, s]) => [
      id,
      {
        ...s,
        updatedAt: s.updatedAt ?? s.completedAt ?? s.startedAt ?? now,
      },
    ]),
  );

  const dailyEntries = Object.fromEntries(
    Object.entries((state.dailyEntries as Record<string, any>) ?? {}).map(([date, e]) => [
      date,
      {
        ...e,
        updatedAt: e.updatedAt ?? `${e.date}T12:00:00.000Z`,
      },
    ]),
  );

  // Convert benchmarkEntries from array to map if still array
  const rawBenchmarks = state.benchmarkEntries;
  const benchmarkArray = Array.isArray(rawBenchmarks) ? rawBenchmarks : Object.values((rawBenchmarks as Record<string, any>) ?? {});
  const benchmarkEntries = Object.fromEntries(
    (benchmarkArray as any[]).map((b) => [
      String(b.week),
      {
        ...b,
        updatedAt: b.updatedAt ?? `${b.date}T12:00:00.000Z`,
      },
    ]),
  );

  return {
    ...state,
    sessionLogs,
    dailyEntries,
    benchmarkEntries,
    progressionEvents: state.progressionEvents ?? [],
  };
}

/**
 * v3 -> v4: strip the Difficulty Index weighting out of every stored
 * SetLog.score (SPEC-V3.0.md section 1, section 7).
 *
 * v3 scores were `raw × (1 + 0.2 × effectiveLevel)`, so a set logged at a
 * harder variant carried a silently inflated number. v4 scores are the plain
 * comparable value — reps, or seconds, or summed attempt seconds — which is
 * exactly what placeholderSetScore already computes. Without this pass, old
 * and new rows in the same export would not be comparable to each other.
 *
 * `settings.resetAt` needs no work here. It is optional and only ever written
 * by the block reset, so on a block that has never been reset it is simply
 * absent — the same treatment carbTargetLow/fatTargetLow already get. Nothing
 * reads it as a required field, and the merge treats "absent" as "no cutoff".
 */
function migrateToV4(state: LegacyPersistedState): LegacyPersistedState {
  const sessionLogs = Object.fromEntries(
    Object.entries((state.sessionLogs as Record<string, SessionLog>) ?? {}).map(([id, session]) => [
      id,
      {
        ...session,
        exercises: (session.exercises ?? []).map((log) => ({
          ...log,
          sets: (log.sets ?? []).map((set) => ({ ...set, score: placeholderSetScore(set) })),
        })),
      },
    ]),
  );

  return { ...state, sessionLogs };
}

/**
 * v4 -> v5: the v4.0 hybrid marathon block (SPEC-V4.0.md section 1).
 *
 * Two stored fields stopped being valid members of their union:
 *
 * 1. `SessionLog.phase`. The old names (calibration, accumulation,
 *    intensification, test) describe a periodisation that no longer exists, so
 *    each session's phase is recomputed from the week it was logged in. This
 *    rewrites what the session *says* about itself, which is acceptable because
 *    phase was always a pure function of week — nothing was ever stored that
 *    could not be re-derived.
 * 2. `Readiness.achillesIrritation`, which is newly required. Old check-ins
 *    never asked, so 0 ("none") is the only honest default; it is also the value
 *    that makes the new Achilles volume warning stay silent about history it
 *    cannot actually speak to.
 *
 * Exercise ids are deliberately untouched. The whole v4.0 program is new, but
 * the old records moved verbatim into retiredExercises.ts and every historical
 * `exerciseId` still resolves through `lookupExercise`.
 */
function migrateToV5(state: LegacyPersistedState): LegacyPersistedState {
  const sessionLogs = Object.fromEntries(
    Object.entries((state.sessionLogs as Record<string, SessionLog>) ?? {}).map(([id, session]) => [
      id,
      {
        ...session,
        phase: phaseForWeek(session.week),
        readiness: session.readiness
          ? { ...session.readiness, achillesIrritation: session.readiness.achillesIrritation ?? 0 }
          : undefined,
      },
    ]),
  );

  return { ...state, sessionLogs };
}

/**
 * v5 -> v6 (v5.0 block): recompute every session phase from its week.
 *
 * The v4 names (baseline, reinforce, overload, rebuild, peak, marathonPeak,
 * taper) describe three loading waves that no longer exist; v5.0 is one arc
 * with a single deload at week 6. Phase has always been a pure function of
 * week, so nothing that could not be re-derived is lost. Exercise ids are
 * untouched — every v4 record that did not carry over moved verbatim into
 * retiredExercises.ts.
 */
function migrateToV6(state: LegacyPersistedState): LegacyPersistedState {
  const sessionLogs = Object.fromEntries(
    Object.entries((state.sessionLogs as Record<string, SessionLog>) ?? {}).map(([id, session]) => [
      id,
      { ...session, phase: phaseForWeek(session.week) },
    ]),
  );
  return { ...state, sessionLogs };
}

/**
 * v6 -> v7 (v5.1 analytics): two new top-level collections, the decision
 * journal and the case-study protocol. Purely additive — no stored record
 * changes shape, so the migration only supplies empty defaults. Both are
 * evidence stores for the analytics case study; nothing in the training rules
 * reads them, so absence is always a valid state.
 */
function migrateToV7(state: LegacyPersistedState): LegacyPersistedState {
  return {
    ...state,
    decisionEntries: state.decisionEntries ?? {},
    caseStudyProtocol: state.caseStudyProtocol ?? null,
  };
}

/**
 * v7 -> v8 (v6.0 block): start the Cut to New Year block fresh.
 *
 * Deliberately destructive, at the athlete's request — the one migration that
 * drops data. What survives:
 *
 * - Daily entries dated on or after V6_BLOCK_START: a weigh-in on day 1 is
 *   day-1 data whichever build recorded it.
 * - Anything written after V6_WIPE_CUTOFF, which only the v6 build can have
 *   done (bar a stale device logging on the old build in the gap).
 *
 * Settings restart from defaults on the new block start. The weight unit and
 * target weight are preferences, not block data, and carry over; the start
 * weight is seeded from the previous block's last 7-day average so the trend
 * and the nutrition row start from where the athlete actually is. Their
 * `updatedAt` is the fixed cutoff, so any real settings change after the
 * migration wins the sync merge.
 *
 * Exercise ids are untouched — the v5.0 records moved verbatim into
 * retiredV5.ts, and an imported v5 export still resolves through them.
 */
function migrateToV8(state: LegacyPersistedState): LegacyPersistedState {
  const oldSettings = state.settings ?? {};
  const previousBlockEntries = Object.values((state.dailyEntries as Record<string, DailyEntry>) ?? {}).filter(
    (e) => e.date < V6_BLOCK_START,
  );
  const lastWeighIn = previousBlockEntries
    .filter((e) => e.weightKg !== undefined)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const seededStart = lastWeighIn
    ? (rolling7Weight(previousBlockEntries, lastWeighIn.date) ?? (lastWeighIn.weightKg as number))
    : undefined;

  const keep = (record: { updatedAt?: string }) => (record.updatedAt ?? '') >= V6_WIPE_CUTOFF;

  const dailyEntries = Object.fromEntries(
    Object.entries((state.dailyEntries as Record<string, DailyEntry>) ?? {}).filter(
      ([, e]) => e.date >= V6_BLOCK_START,
    ),
  );
  const sessionLogs = Object.fromEntries(
    Object.entries((state.sessionLogs as Record<string, SessionLog>) ?? {})
      .filter(([, session]) => keep(session) && session.date >= V6_BLOCK_START)
      .map(([id, session]) => [id, { ...session, phase: phaseForWeek(session.week) }]),
  );
  const benchmarkEntries = Object.fromEntries(
    Object.entries((state.benchmarkEntries as Record<string, BenchmarkEntry>) ?? {}).filter(([, b]) => keep(b)),
  );
  const decisionEntries = Object.fromEntries(
    Object.entries((state.decisionEntries as Record<string, DecisionEntry>) ?? {}).filter(([, d]) => keep(d)),
  );
  const protocol = state.caseStudyProtocol ?? null;

  const defaults = defaultSettings();
  return {
    ...state,
    settings: {
      ...defaults,
      blockStartDate: V6_BLOCK_START,
      startWeightKg: seededStart !== undefined ? roundTo(seededStart, 1) : (oldSettings.startWeightKg ?? defaults.startWeightKg),
      targetWeightKg: oldSettings.targetWeightKg ?? defaults.targetWeightKg,
      weightUnit: oldSettings.weightUnit ?? defaults.weightUnit,
      ...(oldSettings.reminderTime ? { reminderTime: oldSettings.reminderTime } : {}),
      updatedAt: V6_WIPE_CUTOFF,
    },
    dailyEntries,
    sessionLogs,
    benchmarkEntries,
    progressionEvents: (state.progressionEvents ?? []).filter((e) => e.date >= V6_BLOCK_START),
    decisionEntries,
    caseStudyProtocol: protocol && keep(protocol) ? protocol : null,
  };
}

/**
 * Version-by-version migration so a schema change never wipes a block
 * mid-flight. Guards the zustand `persist` rehydration path AND the JSON
 * import path (`parseImportedState`) with the same logic.
 *
 * Settings defaults are re-spread beneath whatever was persisted on every
 * call, not just when fromVersion is stale. zustand's persist merges the
 * top-level `settings` object shallowly, so a persisted settings blob
 * missing a field a later prompt adds (e.g. weightUnit) would otherwise
 * arrive `undefined` at runtime despite the type claiming it exists. This
 * keeps every rehydration current without a version bump for every new
 * optional Settings field.
 */
export function migrate(persistedState: unknown, fromVersion: number): PersistedState {
  return migrateTo(persistedState, fromVersion, SCHEMA_VERSION);
}

/**
 * Runs the version steps after `fromVersion` up to and including `toVersion`,
 * then shapes the result. `migrate` always runs to SCHEMA_VERSION; stopping
 * short exists so the pre-v8 steps stay testable now that v8 wipes the data
 * they transform.
 */
export function migrateTo(persistedState: unknown, fromVersion: number, toVersion: number): PersistedState {
  let state = persistedState as LegacyPersistedState;
  const runs = (step: number) => fromVersion < step && toVersion >= step;

  if (runs(2)) {
    state = migrateToV2(state);
  }

  if (runs(3)) {
    state = migrateToV3(state);
  }

  if (runs(4)) {
    state = migrateToV4(state);
  }

  if (runs(5)) {
    state = migrateToV5(state);
  }

  if (runs(6)) {
    state = migrateToV6(state);
  }

  if (runs(7)) {
    state = migrateToV7(state);
  }

  if (runs(8)) {
    state = migrateToV8(state);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    // updatedAt is NOT re-stamped here. migrate() runs on the REMOTE state on
    // every pull (syncEngine pullRemote), so stamping it `now` made the incoming
    // remote settings unconditionally newer than local, and mergeState picks
    // settings by last-write-wins. That handed every merge to the remote copy,
    // which silently undid "Reset block" — restoring the old blockStartDate and,
    // worse, dropping the resetAt tombstone that keeps deleted sessions deleted.
    // Spreading defaultSettings() first already backfills updatedAt when the
    // stored settings predate it (v1/v2), which is all this ever needed to do.
    settings: { ...defaultSettings(), ...state.settings },
    dailyEntries: state.dailyEntries ?? {},
    sessionLogs: state.sessionLogs ?? {},
    benchmarkEntries: state.benchmarkEntries ?? {},
    progressionEvents: state.progressionEvents ?? [],
    decisionEntries: state.decisionEntries ?? {},
    caseStudyProtocol: state.caseStudyProtocol ?? null,
  };
}

// ---------- export / import (SPEC.md 2, 7.7, acceptance test 20) ----------

const PERSISTED_KEYS: (keyof PersistedState)[] = [
  'schemaVersion',
  'settings',
  'dailyEntries',
  'sessionLogs',
  'benchmarkEntries',
  'progressionEvents',
  'decisionEntries',
  'caseStudyProtocol',
];

/** Pulls only the persisted fields off the store (drops zustand actions). */
export function toPersistedState(state: PersistedState): PersistedState {
  const out = {} as PersistedState;
  for (const key of PERSISTED_KEYS) {
    (out as unknown as Record<string, unknown>)[key] = state[key];
  }
  return out;
}

export function serializeState(state: PersistedState): string {
  return JSON.stringify(toPersistedState(state), null, 2);
}

export class ImportError extends Error {}

/** Parses and validates an exported JSON payload, running it through migrate(). */
export function parseImportedState(json: string): PersistedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ImportError('Not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ImportError('Not a valid BLOCK 12 export.');
  }
  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.schemaVersion !== 'number' || typeof candidate.settings !== 'object') {
    throw new ImportError('Not a valid BLOCK 12 export.');
  }
  const migrated = migrate(candidate, candidate.schemaVersion);
  return toPersistedState(migrated);
}

export function triggerDownload(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJSONExport(state: PersistedState): void {
  triggerDownload(`block12-export-${todayISO()}.json`, serializeState(state), 'application/json');
}

// ---------- CSV export of all sets (SPEC.md 7.7) ----------

const CSV_HEADERS = [
  'date',
  'week',
  'phase',
  'day',
  'block',
  'sessionCompletedAt',
  'exerciseId',
  'exerciseName',
  'setIndex',
  'reps',
  'seconds',
  'minutes',
  'attempts',
  'addedKg',
  'distanceM',
  'intensityPct',
  'rpe',
  'variantId',
  'assistanceTier',
  'romNote',
  'romCm',
  'techniqueFlags',
  'score',
];

export function csvEscape(value: unknown): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildSetsCSV(sessionLogs: Record<string, SessionLog>): string {
  const rows: string[] = [CSV_HEADERS.join(',')];
  const sessions = Object.values(sessionLogs).sort((a, b) => a.date.localeCompare(b.date));
  for (const session of sessions) {
    for (const exerciseLog of session.exercises) {
      exerciseLog.sets.forEach((set, index) => {
        rows.push(
          [
            session.date,
            session.week,
            session.phase,
            session.day,
            session.block,
            session.completedAt ?? '',
            exerciseLog.exerciseId,
            exerciseName(exerciseLog.exerciseId),
            index + 1,
            set.reps,
            set.seconds,
            set.minutes,
            set.attempts ? set.attempts.join('|') : '',
            set.addedKg,
            set.distanceM,
            set.intensityPct,
            set.rpe,
            set.variantId,
            set.assistanceTier,
            set.romNote,
            set.romCm,
            set.techniqueFlags.join('|'),
            set.score,
          ]
            .map(csvEscape)
            .join(','),
        );
      });
    }
  }
  return rows.join('\n');
}

export function downloadSetsCSV(sessionLogs: Record<string, SessionLog>): void {
  triggerDownload(`block12-sets-${todayISO()}.csv`, buildSetsCSV(sessionLogs), 'text/csv');
}

// ---------- CSV export of daily entries (SPEC-V1.1.md section 4, prompt 5) ----------
// Weight is exported in kg regardless of the display unit setting, matching the
// sets CSV's addedKg column -- CSV export is the portable/backup format and
// stays kg-native.

const DAILY_ENTRY_CSV_HEADERS = [
  'date',
  'weightKg',
  'calories',
  'caloriesOverridden',
  'proteinG',
  'carbsG',
  'fatG',
  'steps',
  'checks',
  'note',
];

export function buildDailyEntriesCSV(dailyEntries: Record<string, DailyEntry>): string {
  const rows: string[] = [DAILY_ENTRY_CSV_HEADERS.join(',')];
  const entries = Object.values(dailyEntries).sort((a, b) => a.date.localeCompare(b.date));
  for (const entry of entries) {
    rows.push(
      [
        entry.date,
        entry.weightKg,
        entry.calories,
        entry.caloriesOverridden ?? '',
        entry.proteinG,
        entry.carbsG,
        entry.fatG,
        entry.steps,
        Object.entries(entry.checks ?? {})
          .filter(([, done]) => done)
          .map(([id]) => id)
          .join('|'),
        entry.note,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return rows.join('\n');
}

export function downloadDailyEntriesCSV(dailyEntries: Record<string, DailyEntry>): void {
  triggerDownload(`block12-daily-${todayISO()}.csv`, buildDailyEntriesCSV(dailyEntries), 'text/csv');
}
