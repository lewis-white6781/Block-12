// Versioned localStorage persistence — SPEC.md section 2, 4, 7.7.
// Storage key `block12:v1`, with `schemaVersion` and a `migrate()` stub so a schema
// change never wipes a block mid-flight.
import { format, startOfWeek } from 'date-fns';
import { program } from '../data/program';
import type {
  BenchmarkEntry,
  DailyEntry,
  ProgressionEvent,
  SessionLog,
  Settings,
} from '../domain/types';

export const STORAGE_KEY = 'block12:v1';
export const SCHEMA_VERSION = 1;

export interface PersistedState {
  schemaVersion: number;
  settings: Settings;
  dailyEntries: Record<string, DailyEntry>;
  sessionLogs: Record<string, SessionLog>;
  benchmarkEntries: BenchmarkEntry[];
  progressionEvents: ProgressionEvent[];
}

export function defaultSettings(): Settings {
  return {
    blockStartDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    startWeightKg: 77,
    targetWeightKg: 72.5,
    proteinTargetLow: 170,
    proteinTargetHigh: 190,
    units: 'metric',
  };
}

export function defaultPersistedState(): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    dailyEntries: {},
    sessionLogs: {},
    benchmarkEntries: [],
    progressionEvents: [],
  };
}

/**
 * No schema changes yet — this is a stub. When a future prompt changes the
 * persisted shape, bump SCHEMA_VERSION and add a version-by-version case here
 * instead of discarding whatever was persisted.
 */
export function migrate(persistedState: unknown, _fromVersion: number): PersistedState {
  return persistedState as PersistedState;
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
    (out as Record<string, unknown>)[key] = state[key];
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
  const stamp = format(new Date(), 'yyyy-MM-dd');
  triggerDownload(`block12-export-${stamp}.json`, serializeState(state), 'application/json');
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

const exerciseNameById = new Map(program.map((e) => [e.id, e.name]));

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
            exerciseNameById.get(exerciseLog.exerciseId) ?? exerciseLog.exerciseId,
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
  const stamp = format(new Date(), 'yyyy-MM-dd');
  triggerDownload(`block12-sets-${stamp}.csv`, buildSetsCSV(sessionLogs), 'text/csv');
}
