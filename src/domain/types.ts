// ---------- program (static, seeded) ----------
export type Phase =
  | 'calibration' // weeks 1–2
  | 'accumulation' // weeks 3–5
  | 'deload' // week 6
  | 'intensification' // weeks 7–9
  | 'peak' // week 10
  | 'taper' // week 11
  | 'test'; // week 12

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type Block = 'am' | 'main';

export type MetricType =
  | 'reps' // bodyweight or skill reps
  | 'weightedReps' // reps + added kg
  | 'hold' // seconds
  | 'attempts' // handstand: attempts per set, each with a hold time
  | 'timeOnly' // mobility hold, no scoring
  | 'sprint' // distance + intensity %
  | 'distanceTime'; // easy run: minutes

export interface Prescription {
  weeks: number[]; // e.g. [1,2]
  sets: number; // target sets
  repsLow?: number;
  repsHigh?: number;
  secLow?: number;
  secHigh?: number;
  rpeLow?: number;
  rpeHigh?: number;
  note?: string; // e.g. "test reps or increased ROM"
  perSide?: boolean;
}

export interface Exercise {
  id: string; // stable slug, e.g. 'fl-hard-iso'
  name: string;
  day: DayId;
  block: Block;
  order: number;
  metric: MetricType;
  ladderId?: string; // links to a variant ladder in ladders.ts
  tracked: boolean; // false => AM mobility items: completion checkbox only
  coreFunction?: string; // 'anti-extension' etc.
  cues: string[]; // shown collapsed on the card
  progressionLadder: string[]; // ORDERED axes to advance, e.g. ['cleaner line','greater ROM',...]
  stopRules: string[]; // exercise-specific technique failures
  prescriptions: Prescription[];
}

// ---------- ladders ----------
export interface Variant {
  id: string;
  label: string;
  level: number;
} // level = difficulty index
export interface Ladder {
  id: string;
  variants: Variant[];
  assistanceTiers: string[];
}
// assistanceTiers: ['none','light band','medium band','heavy band'] -> index 0..3

// ---------- logging ----------
export interface SetLog {
  id: string;
  reps?: number;
  seconds?: number; // for holds; for 'attempts' this is the best attempt
  attempts?: number[]; // seconds per attempt
  addedKg?: number;
  distanceM?: number; // sprint metric: metres for this rep
  intensityPct?: number; // sprint metric: intensity % for this rep
  rpe?: number; // 6..10 in 0.5 steps
  variantId?: string; // snapshot of variant used
  assistanceTier?: number; // 0..3
  romNote?: string; // e.g. "feet on 40cm box", "lean 12cm"
  techniqueFlags: TechniqueFlag[];
  score: number; // computed at write time AND recomputed on read
}

export type TechniqueFlag =
  | 'hipsSagged'
  | 'elbowsUnlocked'
  | 'lineChanged'
  | 'usedMomentum'
  | 'partialROM'
  | 'collapsed'
  | 'assistedExtra';

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
  skipped?: boolean;
  note?: string;
}

export interface SessionLog {
  id: string; // `${date}:${block}`
  date: string; // ISO yyyy-mm-dd
  week: number;
  phase: Phase;
  day: DayId;
  block: Block;
  startedAt: string;
  completedAt?: string;
  readiness?: Readiness;
  exercises: ExerciseLog[];
  sessionRpe?: number;
  note?: string;
}

export interface Readiness {
  sleepHours: number; // 0–12, 0.5 steps
  soreness: 0 | 1 | 2 | 3;
  elbowIrritation: 0 | 1 | 2 | 3;
  shoulderIrritation: 0 | 1 | 2 | 3;
  motivation: 0 | 1 | 2 | 3;
}

// ---------- body & nutrition ----------
export interface DailyEntry {
  date: string; // ISO, primary key
  weightKg?: number; // morning, fasted
  calories?: number;
  proteinG?: number;
  steps?: number; // optional
  note?: string;
}

// ---------- mobility benchmarks (weeks 1, 6, 12) ----------
export interface BenchmarkEntry {
  date: string;
  week: number;
  values: Record<string, number>; // benchmarkId -> value (cm or degrees)
  photoNote?: string;
}

// ---------- progression events (the one-variable rule) ----------
export interface ProgressionEvent {
  id: string;
  date: string;
  exerciseId: string;
  axis: string; // must be one of exercise.progressionLadder
  from: string;
  to: string;
  note?: string;
}

export interface Settings {
  blockStartDate: string; // ISO Monday of week 1
  startWeightKg: number; // 77
  targetWeightKg: number; // 72.5
  proteinTargetLow: number; // 170
  proteinTargetHigh: number; // 190
  units: 'metric';
  reminderTime?: string;
}
