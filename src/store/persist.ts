// Versioned localStorage persistence — SPEC.md section 2, 4.
// Storage key `block12:v1`, with `schemaVersion` and a `migrate()` stub so a schema
// change never wipes a block mid-flight.
import { format, startOfWeek } from 'date-fns';
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
