// Zustand store: entries, logs, settings, actions — SPEC.md section 4, 7.1–7.2.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { defaultPersistedState, migrate, SCHEMA_VERSION, STORAGE_KEY } from './persist';
import type { PersistedState } from './persist';
import type {
  BenchmarkEntry,
  Block,
  DailyEntry,
  DayId,
  ExerciseLog,
  Phase,
  ProgressionEvent,
  Readiness,
  SessionLog,
  SetLog,
  Settings,
} from '../domain/types';

interface StartSessionParams {
  date: string;
  block: Block;
  day: DayId;
  week: number;
  phase: Phase;
  readiness?: Readiness;
}

interface StoreActions {
  updateSettings: (patch: Partial<Settings>) => void;
  upsertDailyEntry: (entry: DailyEntry) => void;
  /** Creates the session if it doesn't already exist; otherwise leaves it untouched. */
  startSession: (params: StartSessionParams) => string;
  logSet: (sessionId: string, exerciseId: string, setLog: SetLog) => void;
  /** Toggles a single-set completion marker for an untracked AM checklist item. */
  toggleAmChecklistItem: (exerciseId: string, params: StartSessionParams) => void;
  completeSession: (sessionId: string, patch?: { sessionRpe?: number; note?: string }) => void;
  /** One entry per (date, week) pair — replaces any existing entry for that week. */
  upsertBenchmarkEntry: (entry: BenchmarkEntry) => void;
  addProgressionEvent: (event: ProgressionEvent) => void;
}

export type StoreState = PersistedState & StoreActions;

function ensureSession(sessionLogs: Record<string, SessionLog>, params: StartSessionParams): Record<string, SessionLog> {
  const id = `${params.date}:${params.block}`;
  if (sessionLogs[id]) return sessionLogs;
  const session: SessionLog = {
    id,
    date: params.date,
    week: params.week,
    phase: params.phase,
    day: params.day,
    block: params.block,
    startedAt: new Date().toISOString(),
    readiness: params.readiness,
    exercises: [],
  };
  return { ...sessionLogs, [id]: session };
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      ...defaultPersistedState(),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      upsertDailyEntry: (entry) =>
        set((s) => ({
          dailyEntries: {
            ...s.dailyEntries,
            [entry.date]: { ...s.dailyEntries[entry.date], ...entry },
          },
        })),

      startSession: (params) => {
        const id = `${params.date}:${params.block}`;
        set((s) => ({ sessionLogs: ensureSession(s.sessionLogs, params) }));
        return id;
      },

      logSet: (sessionId, exerciseId, setLog) =>
        set((s) => {
          const session = s.sessionLogs[sessionId];
          if (!session) return {};
          const hasExercise = session.exercises.some((e) => e.exerciseId === exerciseId);
          const exercises: ExerciseLog[] = hasExercise
            ? session.exercises.map((e) =>
                e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, setLog] } : e,
              )
            : [...session.exercises, { exerciseId, sets: [setLog] }];
          return { sessionLogs: { ...s.sessionLogs, [sessionId]: { ...session, exercises } } };
        }),

      toggleAmChecklistItem: (exerciseId, params) =>
        set((s) => {
          const sessionLogs = ensureSession(s.sessionLogs, params);
          const id = `${params.date}:${params.block}`;
          const session = sessionLogs[id];
          const existing = session.exercises.find((e) => e.exerciseId === exerciseId);
          const isDone = (existing?.sets.length ?? 0) > 0;

          const exercises: ExerciseLog[] = isDone
            ? session.exercises.map((e) =>
                e.exerciseId === exerciseId ? { ...e, sets: [] } : e,
              )
            : existing
              ? session.exercises.map((e) =>
                  e.exerciseId === exerciseId
                    ? { ...e, sets: [{ id: crypto.randomUUID(), techniqueFlags: [], score: 0 }] }
                    : e,
                )
              : [
                  ...session.exercises,
                  {
                    exerciseId,
                    sets: [{ id: crypto.randomUUID(), techniqueFlags: [], score: 0 }],
                  },
                ];

          return { sessionLogs: { ...sessionLogs, [id]: { ...session, exercises } } };
        }),

      completeSession: (sessionId, patch) =>
        set((s) => {
          const session = s.sessionLogs[sessionId];
          if (!session) return {};
          return {
            sessionLogs: {
              ...s.sessionLogs,
              [sessionId]: {
                ...session,
                completedAt: new Date().toISOString(),
                sessionRpe: patch?.sessionRpe ?? session.sessionRpe,
                note: patch?.note ?? session.note,
              },
            },
          };
        }),

      upsertBenchmarkEntry: (entry) =>
        set((s) => ({
          benchmarkEntries: [...s.benchmarkEntries.filter((b) => b.week !== entry.week), entry],
        })),

      addProgressionEvent: (event) =>
        set((s) => ({ progressionEvents: [...s.progressionEvents, event] })),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate,
    },
  ),
);

/** Most recent logged set for an exercise, strictly before `beforeDate`, if any. */
export function findPreviousExerciseLog(
  sessionLogs: Record<string, SessionLog>,
  exerciseId: string,
  beforeDate: string,
): { session: SessionLog; log: ExerciseLog } | null {
  let best: { session: SessionLog; log: ExerciseLog } | null = null;
  for (const session of Object.values(sessionLogs)) {
    if (session.date >= beforeDate) continue;
    const log = session.exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
    if (!log) continue;
    if (!best || session.date > best.session.date) {
      best = { session, log };
    }
  }
  return best;
}
