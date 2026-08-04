// Versioned localStorage persistence — SPEC.md section 2, 4, 7.7.
// Storage key `block12:v1`, with `schemaVersion` and a real migrate() so a schema
// change never wipes a block mid-flight.
import { format, startOfWeek } from 'date-fns';
import { exerciseName } from '../data/exercises';
import { startOfToday, todayISO } from '../domain/clock';
import { placeholderSetScore } from '../domain/scoring';
import type {
  BenchmarkEntry,
  DailyEntry,
  ProgressionEvent,
  SessionLog,
  Settings,
} from '../domain/types';

export const STORAGE_KEY = 'block12:v1';
export const SCHEMA_VERSION = 4;

export interface PersistedState {
  schemaVersion: number;
  settings: Settings;
  dailyEntries: Record<string, DailyEntry>;
  sessionLogs: Record<string, SessionLog>;
  benchmarkEntries: Record<string, BenchmarkEntry>;
  progressionEvents: ProgressionEvent[];
}

export function defaultSettings(): Settings {
  return {
    blockStartDate: format(startOfWeek(startOfToday(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    startWeightKg: 77,
    targetWeightKg: 72.5,
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
  let state = persistedState as LegacyPersistedState;

  if (fromVersion < 2) {
    state = migrateToV2(state);
  }

  if (fromVersion < 3) {
    state = migrateToV3(state);
  }

  if (fromVersion < 4) {
    state = migrateToV4(state);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...defaultSettings(), ...state.settings, updatedAt: new Date().toISOString() },
    dailyEntries: state.dailyEntries ?? {},
    sessionLogs: state.sessionLogs ?? {},
    benchmarkEntries: state.benchmarkEntries ?? {},
    progressionEvents: state.progressionEvents ?? [],
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

function triggerDownload(filename: string, contents: string, mimeType: string): void {
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

function csvEscape(value: unknown): string {
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
