// ---------- program (static, seeded) ----------
// v4.0: three four-week loading waves replace the old single-arc periodisation.
// Deloads now fall on weeks 4, 8 and 12 — see SPEC-V4.0.md section 3.
export type Phase =
  | 'reentry' // weeks 1–2  — establish the post-break baseline around RPE 8
  | 'accumulation' // weeks 3–5  — sets and difficulty climb
  | 'deload' // week 6    — volume −40–50%, RPE 6–7
  | 'intensification' // weeks 7–10 — harder leverage, heavier loading
  | 'realization' // week 11   — highest-quality hard work, no failure
  | 'consolidation'; // week 12   — lower volume, benchmark and compare

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

// v4.0: a third slot. Wednesday carries an AM grease-the-groove block, a main
// full-body lift AND a later recovery run, which 'am' | 'main' could not express.
export type Block = 'am' | 'main' | 'later';

export type MetricType =
  | 'reps' // bodyweight or skill reps
  | 'weightedReps' // reps + added kg
  | 'hold' // seconds
  | 'attempts' // handstand: attempts per set, each with a hold time
  | 'timeOnly' // mobility hold, no scoring
  | 'runInterval' // a prescribed run block: minutes + RPE + optional distance
  | 'carry' // loaded carry: distance + added kg + RPE
  // The two below are no longer prescribed by any exercise in `program`. They
  // stay in the union because `retiredExercises` entries are typed `Exercise`
  // and historical logs still resolve through them.
  | 'sprint' // distance + intensity %
  | 'distanceTime'; // pre-v4 easy run: minutes, stored in `reps`

/**
 * Which RPE table an exercise is read against — SPEC-V4.0.md section 1 defines
 * three, and they do not share bounds. A recovery run at RPE 2 and a stretch at
 * RPE 6 are both unloggable against the 6–10 strength scale.
 */
export type RpeScale =
  | 'strength' // 6–10, reps in reserve. The default.
  | 'stretch' // 5–8, never 9–10
  | 'run'; // 1–10, easy work genuinely sits at 2

export interface Prescription {
  weeks: number[]; // e.g. [1,2]
  // Target sets. ZERO means "not prescribed this week" — `exercisesFor` drops
  // it. This is how the Wednesday recovery run stays absent in weeks 1, 2 and 4
  // without `resolvePrescription`'s nearest-earlier fallback leaking a later
  // week's numbers backwards. SPEC-V4.0.md section 4.
  sets: number;
  repsLow?: number;
  repsHigh?: number;
  secLow?: number;
  secHigh?: number;
  rpeLow?: number;
  rpeHigh?: number;
  minutesEach?: number; // runInterval: duration of one prescribed block
  distanceM?: number; // carry: metres per set
  note?: string; // e.g. "test reps or increased ROM"
  perSide?: boolean;
}

export interface Exercise {
  id: string; // stable slug, e.g. 'fl-hold-primary'
  name: string;
  day: DayId;
  block: Block;
  order: number;
  metric: MetricType;
  ladderId?: string; // links to a variant ladder in ladders.ts
  tracked: boolean; // false => completion checkbox only
  rpeScale?: RpeScale; // default 'strength'
  setsLabel?: 'sets' | 'rounds'; // GTG blocks prescribe rounds, not sets
  restSeconds?: number; // where SPEC-V4.0.md states a rest; else bucketed by metric
  supersetId?: string; // e.g. 'mon-7' for Monday's 7A/7B pair
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
} // level = position on the ladder, ascending. v3.0: a grouping key and an
// ordering, never a coefficient — see src/domain/performance.ts.
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
  // Minutes for one run block. Deliberately its own field: the pre-v4
  // `distanceTime` metric stored minutes in `reps`, which is why run data was
  // indistinguishable from rep data downstream. SPEC-V4.0.md section 2.
  minutes?: number;
  distanceM?: number; // metres — sprint (per rep), carry (per set), run (optional, for pace)
  intensityPct?: number; // sprint metric: intensity % for this rep
  rpe?: number; // bounds depend on the exercise's RpeScale; always 0.5 steps
  variantId?: string; // snapshot of variant used
  assistanceTier?: number; // 0..3
  romNote?: string; // e.g. "feet on 40cm box", "lean 12cm"
  // Height in cm of the pad/block stack the head touches at the bottom of the
  // rep. LOWER IS DEEPER IS BETTER — the one field in this interface where a
  // smaller number is a better set. Shown only for exercises whose
  // progressionLadder includes 'greater ROM'. SPEC-V3.0.md section 2.
  romCm?: number;
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
  updatedAt: string; // ISO timestamp, bumped on every set logged or session change
}

export interface Readiness {
  sleepHours: number; // 0–12, 0.5 steps
  soreness: 0 | 1 | 2 | 3;
  elbowIrritation: 0 | 1 | 2 | 3;
  shoulderIrritation: 0 | 1 | 2 | 3;
  // v4.0: SPEC-V4.0.md section 7's joint rule names Achilles explicitly, and it
  // is the injury that ends a marathon block. Defaulted to 0 by migrateToV5.
  achillesIrritation: 0 | 1 | 2 | 3;
  motivation: 0 | 1 | 2 | 3;
}

// ---------- body & nutrition ----------
export interface DailyEntry {
  date: string; // ISO, primary key
  weightKg?: number; // morning, fasted
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  // true once calories has been typed directly rather than derived from
  // macros (4/4/9) — SPEC-V1.1.md section 3. The typed value then wins.
  caloriesOverridden?: boolean;
  steps?: number; // optional
  note?: string;
  updatedAt: string; // ISO timestamp
}

// ---------- mobility benchmarks (weeks 1, 6, 12) ----------
export interface BenchmarkEntry {
  date: string;
  week: number;
  values: Record<string, number>; // benchmarkId -> value (cm or degrees)
  photoNote?: string;
  updatedAt: string; // ISO timestamp
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
  startWeightKg: number; // 80 — SPEC-V5.0.md: starting bodyweight ~80 kg
  targetWeightKg: number; // 73 — 12-week target ~73 kg
  proteinTargetLow: number; // 170
  proteinTargetHigh: number; // 190
  // Unlike protein, SPEC.md gives no numeric carb/fat targets — the user sets
  // these themselves, so they stay unset (no band shown) until they do.
  carbTargetLow?: number;
  carbTargetHigh?: number;
  fatTargetLow?: number;
  fatTargetHigh?: number;
  units: 'metric';
  // Display/entry unit only (SPEC-V1.1.md section 3). The domain and all
  // stored/exported weight values are always kg regardless of this setting.
  weightUnit: 'kg' | 'lbs';
  reminderTime?: string;
  // ISO timestamp of the last "Reset block". The merge tombstone cutoff: a
  // REMOTE record older than this was deleted by the reset and must not be
  // resurrected by the union-based merge. SPEC-V3.0.md section 6.
  resetAt?: string;
  // ISO timestamp stamped when the dev-only demo seed overwrote this state.
  // v5.1 analytics provenance: any export whose settings carry this flag is
  // synthetic demonstration data and must never be presented as a genuine
  // observation. Cleared only by reset or by importing/merging real state.
  demoSeededAt?: string;
  updatedAt: string; // ISO timestamp, bumped on any settings change
}

// ---------- decision journal (v5.1 — analytics case study) ----------
// One entry per decision: what the system showed, what was decided, what was
// actually changed, and what the follow-up observation window is. The entry is
// EVIDENCE, not configuration — nothing in the training rules reads it back.
// Evidence text is a frozen snapshot of what was on screen at decision time;
// later edits to logs never rewrite it.

export type DecisionSource =
  | 'stagnation' // the stagnation detector's card
  | 'stopRule' // a live stop-rule banner
  | 'guardrail' // a tendon/churn guardrail in Review
  | 'jointWarning' // a joint-volume warning on Today
  | 'weeklyReview' // prompted by reading the weekly review
  | 'manual'; // self-initiated, no system prompt

export type DecisionChoice =
  | 'accepted' // did what the recommendation said
  | 'deferred' // will act later
  | 'rejected' // decided against it
  | 'overridden' // did something different from the recommendation
  | 'manual'; // no recommendation existed — self-initiated change or hold

export type FollowUpOutcome =
  | 'improved'
  | 'maintained'
  | 'declined'
  | 'notComparable' // variant/exercise changed, or the block ended
  | 'insufficientData';

export interface DecisionFollowUp {
  recordedAt: string; // ISO timestamp
  /** Comparable sessions observed between the decision and this follow-up. */
  comparableSessions: number;
  /** What the logs show — numbers and dates, kept separate from judgement. */
  observation: string;
  outcome: FollowUpOutcome;
  /** The athlete's reading of the observation. Optional, clearly subjective. */
  interpretation?: string;
}

export interface DecisionEntry {
  id: string;
  /** The day the decision was made (yyyy-mm-dd). */
  eventDate: string;
  /** When the entry was written. A gap from eventDate marks it retrospective. */
  createdAt: string;
  source: DecisionSource;
  exerciseId?: string;
  /** Frozen snapshot of the values/message visible at decision time. */
  evidence: string;
  /** What the system recommended, verbatim. Absent for manual entries. */
  recommendation?: string;
  /** App version whose rules produced the recommendation. */
  ruleVersion: string;
  decision: DecisionChoice;
  /** The actual change made — including a deliberate "hold the plan". */
  action: string;
  reason?: string;
  /** What should be observable if this was the right call. */
  expectedObservation?: string;
  /** Follow-up window, in comparable sessions (or days when no exercise). */
  followUpSessions: number;
  /** Link to the ProgressionEvent this decision produced, if any. */
  progressionEventId?: string;
  followUp?: DecisionFollowUp;
  updatedAt: string; // ISO timestamp — LWW merge key
}

// ---------- case-study protocol (v5.1) ----------
// A small versioned measurement protocol: define the question, anchors,
// windows and rules BEFORE reading the results. Amendments are append-only
// with a date and reason so the definition can't silently drift.

export interface ProtocolAmendment {
  date: string; // ISO timestamp
  version: number; // the version this amendment produced
  reason: string;
  change: string;
}

export interface CaseStudyProtocol {
  version: number; // 1 at creation, +1 per amendment
  createdAt: string; // ISO timestamp
  question: string;
  /** Observation window (yyyy-mm-dd). */
  startDate: string;
  endDate: string;
  /** Exercise ids whose performance answers the primary question. */
  anchorExerciseIds: string[];
  primaryOutcomes: string;
  secondaryOutcomes?: string;
  baselineWindow: string; // e.g. "weeks 1–2 best qualifying set"
  endpointWindow: string; // e.g. "weeks 11–12 best qualifying set"
  comparisonRules: string;
  missingDataRule: string;
  followUpSessions: number; // default decision follow-up window
  /**
   * Auto-generated at creation: how much data already existed. A protocol
   * recorded after training began is retrospective for that data and must
   * never be presented as preregistration of the whole block.
   */
  preexistingDataNote: string;
  retrospective: boolean;
  amendments: ProtocolAmendment[];
  updatedAt: string; // ISO timestamp — LWW merge key
}
