// THE CUT TO NEW YEAR BLOCK — SPEC-V6.0.md sections 2–4 and the per-day tables.
// Upper A / Rest / Football / Upper B / Football / Mobility + Core / Lower.
//
// Transcribed exactly from cut-to-new-year-training-nutrition.md. Do not
// invent, round, or paraphrase any prescription. The plan states ONE weekly
// table ("Sets by phase") and two rules that every session row is read
// against, so they are authored once here as builders rather than retyped per
// exercise:
//
//   - ★ exercises follow the ★ column: 3, 3, 4, 4, 2, 4, 4, 4, 4–5, 4–5, then
//     "Floor only" for the Christmas fortnight.
//   - "All other exercises: 3 sets (2 in Week 5)". Where a session table states
//     a different count (2 for the stretches, 4 for the L-sit, 3–4 for the
//     jumps) that count replaces the 3, and week 5 is still 2.
//   - RPE is the phase's: 8–8.5, 8.5, 6–7, 8.5–9, 9.5–10, and "—" at
//     Christmas. A row that states its own RPE ("@ RPE 7", "Stretch intensity
//     RPE 6–7.5") keeps it.
//   - Weeks 11–12 run the FLOOR session only: exercises 1–3 on the upper days,
//     the warm-up plus 1, 2 and 4 on Lower, 1–4 on Mobility + Core. Everything
//     else is authored `sets: 0` there so `exercisesFor` drops it.
//
// Conventions worth knowing before editing:
//
//   - A range on a field the type stores as ONE number (sets) takes the high
//     end and records the range in `note` — "4–5 sets", "3–4 sets".
//   - The plan gives the floor session no set count for ★ exercises ("Floor
//     only") and no RPE ("—"). The floor uses the general "3 sets" rule and
//     leaves RPE unset; the note says so (SPEC-V6.0.md section 4).
//   - A superset row ("Lateral raise + weighted triceps") is two exercises that
//     share a `supersetId` and the row's number, so each logs its own load.
//     An "or" row ("Front lever raise or straddle negative") is one exercise.
import type { Block, DayId, Exercise, Prescription } from '../domain/types';

/** The name of each session, one per (day, block). */
export const sessionTitles: Record<DayId, Partial<Record<Block, string>>> = {
  mon: { main: 'Upper A — push-led' },
  tue: {},
  wed: {},
  thu: { main: 'Upper B — pull-led (garage)' },
  fri: {},
  sat: { main: 'Mobility + Core' },
  sun: { main: 'Lower — athletic' },
};

/**
 * A short name for the whole day, for the places that need to say which day an
 * exercise belongs to without room for the full session title — the Today
 * header, the Progress exercise picker.
 */
export const dayTitles: Record<DayId, string> = {
  mon: 'Upper A',
  tue: 'Rest',
  wed: 'Football',
  thu: 'Upper B',
  fri: 'Football',
  sat: 'Mobility + Core',
  sun: 'Lower',
};

// ---------------------------------------------------------------------------
// Daily tick boxes — SPEC-V6.0.md section 2.
//
// Handstand practice + mobility runs every day and football runs Wednesday and
// Friday. The plan prescribes both as done / not done, so they are a tick box
// on the day (DailyEntry.checks), not a session with exercises to log.
// ---------------------------------------------------------------------------

export interface DailyCheck {
  id: string; // stable key in DailyEntry.checks — never rename
  label: string;
  detail?: string;
  days: DayId[];
}

const EVERY_DAY: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const dailyChecks: DailyCheck[] = [
  {
    id: 'handstand-mobility',
    label: 'Handstand + mobility',
    detail: '5–10 min handstand practice, then 5 min mobility',
    days: EVERY_DAY,
  },
  { id: 'football', label: 'Football', days: ['wed', 'fri'] },
];

/** The tick boxes a given day carries, in display order. */
export function dailyChecksFor(day: DayId): DailyCheck[] {
  return dailyChecks.filter((check) => check.days.includes(day));
}

// ---------------------------------------------------------------------------
// The "Sets by phase" table
// ---------------------------------------------------------------------------

/** The table as the plan prints it, for the Program screen's reference card. */
export const phaseTable: { phase: string; weeks: number[]; starSets: string; rpe: string }[] = [
  { phase: 'Build 1', weeks: [1, 2], starSets: '3', rpe: '8–8.5' },
  { phase: 'Build 2', weeks: [3, 4], starSets: '4', rpe: '8.5' },
  { phase: 'Deload', weeks: [5], starSets: '2', rpe: '6–7' },
  { phase: 'Build 3', weeks: [6, 7, 8], starSets: '4', rpe: '8.5–9' },
  { phase: 'Peak + test', weeks: [9, 10], starSets: '4–5', rpe: '9.5–10' },
  { phase: 'Christmas', weeks: [11, 12], starSets: 'Floor only', rpe: '—' },
];

/** The rules printed under the table, verbatim. */
export const planRules: string[] = [
  'Exercises marked ★ follow this table. All other exercises: 3 sets (2 in Week 5).',
  'Rest: ★ exercises 3–4 min, others 2 min.',
  'Progress: top of rep range on every set → harder progression or +1.25–2.5 kg.',
  'Floor session = exercises 1–3 (Lower: warm-up, 1, 2, 4; Mobility + Core: 1–4).',
];

/** Phase RPE for weeks 1–10. Weeks 11–12 (Christmas) prescribe none. */
const PHASE_RPE: [low: number, high: number][] = [
  [8, 8.5], // 1  Build 1
  [8, 8.5], // 2
  [8.5, 8.5], // 3  Build 2
  [8.5, 8.5], // 4
  [6, 7], // 5  Deload
  [8.5, 9], // 6  Build 3
  [8.5, 9], // 7
  [8.5, 9], // 8
  [9.5, 10], // 9  Peak + test
  [9.5, 10], // 10
];

/** ★ sets for weeks 1–10; "4–5" takes the high end with the range in the note. */
const STAR_SETS = [3, 3, 4, 4, 2, 4, 4, 4, 5, 5];
const STAR_NOTES: Record<number, string> = { 9: '4–5 sets', 10: '4–5 sets' };

const DELOAD_WEEK = 5;
const CHRISTMAS_WEEKS = [11, 12];
const FLOOR_NOTE = 'Christmas floor session';
// The ★ column reads "Floor only" with no number; "All other exercises: 3 sets"
// is the only count the plan states, so the floor uses it.
const STAR_FLOOR_NOTE = 'Christmas floor session — no ★ count given, 3 sets';

/** The per-rep / per-hold fields of a row, constant across the block. */
type Dose = Pick<Prescription, 'repsLow' | 'repsHigh' | 'secLow' | 'secHigh' | 'minutesEach' | 'perSide'>;

interface ScheduleOptions {
  /** True if the exercise is part of its session's Christmas floor. */
  floor: boolean;
  /** An RPE the row states itself, replacing the phase's in every week. */
  rpe?: [low: number, high: number];
}

function withRpe(rpe: [number, number] | undefined): Pick<Prescription, 'rpeLow' | 'rpeHigh'> {
  return rpe ? { rpeLow: rpe[0], rpeHigh: rpe[1] } : {};
}

function christmas(dose: Dose, sets: number, opts: ScheduleOptions, floorNote: string): Prescription[] {
  return CHRISTMAS_WEEKS.map((week) =>
    opts.floor
      ? { weeks: [week], sets, ...dose, ...withRpe(opts.rpe), note: floorNote }
      : { weeks: [week], sets: 0 },
  );
}

/** A ★ exercise: the ★ column for sets, the phase (or stated) RPE. */
function star(dose: Dose, opts: ScheduleOptions): Prescription[] {
  const weeks = STAR_SETS.map((sets, i): Prescription => {
    const week = i + 1;
    return {
      weeks: [week],
      sets,
      ...dose,
      ...withRpe(opts.rpe ?? PHASE_RPE[i]),
      ...(STAR_NOTES[week] ? { note: STAR_NOTES[week] } : {}),
    };
  });
  return [...weeks, ...christmas(dose, 3, opts, STAR_FLOOR_NOTE)];
}

/**
 * Any other exercise: its table's set count (3 unless the row says otherwise),
 * 2 in week 5, the phase (or stated) RPE.
 */
function other(dose: Dose, opts: ScheduleOptions & { sets?: number; setsNote?: string }): Prescription[] {
  const sets = opts.sets ?? 3;
  const weeks = PHASE_RPE.map((phaseRpe, i): Prescription => {
    const week = i + 1;
    const deload = week === DELOAD_WEEK;
    return {
      weeks: [week],
      sets: deload ? 2 : sets,
      ...dose,
      ...withRpe(opts.rpe ?? phaseRpe),
      ...(!deload && opts.setsNote ? { note: opts.setsNote } : {}),
    };
  });
  return [...weeks, ...christmas(dose, sets, opts, FLOOR_NOTE)];
}

// The plan's progression rule, the same for every exercise.
const PROGRESSION = ['top of the rep range on every set', 'harder progression or +1.25–2.5 kg'];
const STAR_REST = 210; // "★ exercises 3–4 min"
const OTHER_REST = 120; // "others 2 min"

// Movement standards carried with the v5.0 records of the same movements — the
// set ends when the standard breaks, not when gravity wins.
const FL_STOP = ['hips dropped below shoulder line', 'scapular position collapsed', 'elbows bent'];
const HSPU_STOP = ['ROM shortened', 'line collapsed', 'needed momentum'];
const DIP_STOP = ['lost stable depth', 'lost full lockout', 'rings drifted or bounced'];
const STRETCH_STOP = ['spine compensated excessively', 'joint felt pinched', 'active control disappeared'];

// "Stretch intensity RPE 6–7.5" — Mobility + Core's stretches, every week.
const STRETCH_RPE: [number, number] = [6, 7.5];

export const program: Exercise[] = [
  // ==========================================================================
  // MONDAY — UPPER A (PUSH-LED). Floor: 1–3.
  // ==========================================================================
  {
    id: 'hspu-primary',
    name: 'Primary HSPU (deficit pike → wall HSPU)',
    day: 'mon',
    block: 'main',
    order: 1,
    metric: 'weightedReps',
    ladderId: 'hspu',
    tracked: true,
    restSeconds: STAR_REST,
    cues: ['★ 4–6 reps', 'rest 3–4 min'],
    progressionLadder: PROGRESSION,
    stopRules: HSPU_STOP,
    prescriptions: star({ repsLow: 4, repsHigh: 6 }, { floor: true }),
  },
  {
    id: 'ring-dip',
    name: 'Weighted ring dip',
    day: 'mon',
    block: 'main',
    order: 2,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: STAR_REST,
    cues: ['★ 4–6 reps', 'rest 3–4 min'],
    progressionLadder: PROGRESSION,
    stopRules: DIP_STOP,
    prescriptions: star({ repsLow: 4, repsHigh: 6 }, { floor: true }),
  },
  {
    id: 'ring-pullup',
    name: 'Weighted pull-up',
    day: 'mon',
    block: 'main',
    order: 3,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: STAR_REST,
    cues: ['★ 3–5 reps', 'rest 3–4 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['kicked', 'top standard dropped', 'dead hang skipped'],
    prescriptions: star({ repsLow: 3, repsHigh: 5 }, { floor: true }),
  },
  {
    id: 'fl-hold-banded',
    name: 'Band-assisted straddle/full front lever hold',
    day: 'mon',
    block: 'main',
    order: 4,
    metric: 'hold',
    ladderId: 'frontLever',
    tracked: true,
    restSeconds: OTHER_REST,
    cues: ['8–10 s @ RPE 7', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: FL_STOP,
    prescriptions: other({ secLow: 8, secHigh: 10 }, { floor: false, rpe: [7, 7] }),
  },
  {
    id: 'lateral-raise',
    name: 'Lateral raise',
    day: 'mon',
    block: 'main',
    order: 5,
    metric: 'weightedReps',
    tracked: true,
    supersetId: 'mon-5',
    restSeconds: OTHER_REST,
    cues: ['10–15 reps', 'superset with the overhead triceps', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['leg drive appeared', 'shrugged', 'torso swung'],
    prescriptions: other({ repsLow: 10, repsHigh: 15 }, { floor: false }),
  },
  {
    id: 'overhead-triceps-ext',
    name: 'Weighted triceps extension (overhead)',
    day: 'mon',
    block: 'main',
    order: 5,
    metric: 'weightedReps',
    tracked: true,
    supersetId: 'mon-5',
    restSeconds: OTHER_REST,
    cues: ['8–12 reps', 'superset with the lateral raise', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['elbows flared', 'shoulders took over'],
    prescriptions: other({ repsLow: 8, repsHigh: 12 }, { floor: false }),
  },
  {
    id: 'dragon-flag',
    name: 'Dragon flag',
    day: 'mon',
    block: 'main',
    order: 6,
    metric: 'reps',
    ladderId: 'dragonFlag',
    tracked: true,
    restSeconds: OTHER_REST,
    coreFunction: 'long-lever anti-extension',
    cues: ['4–6 reps', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['lumbar arched', 'body piked at the hips', 'eccentric sped up'],
    prescriptions: other({ repsLow: 4, repsHigh: 6 }, { floor: false }),
  },

  // ==========================================================================
  // THURSDAY — UPPER B (PULL-LED, GARAGE). Floor: 1–3.
  // ==========================================================================
  {
    id: 'fl-hold-primary',
    name: 'Hard front lever hold',
    day: 'thu',
    block: 'main',
    order: 1,
    metric: 'hold',
    ladderId: 'frontLever',
    tracked: true,
    restSeconds: STAR_REST,
    cues: ['★ 5–8 s hold', 'rest 3–4 min'],
    progressionLadder: PROGRESSION,
    stopRules: FL_STOP,
    prescriptions: star({ secLow: 5, secHigh: 8 }, { floor: true }),
  },
  {
    id: 'fl-raise',
    name: 'Front lever raise or straddle negative',
    day: 'thu',
    block: 'main',
    order: 2,
    metric: 'reps',
    ladderId: 'frontLever',
    tracked: true,
    restSeconds: STAR_REST,
    cues: ['★ 4–6 reps', 'rest 3–4 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['elbows bent', 'hips piked', 'momentum from the swing'],
    prescriptions: star({ repsLow: 4, repsHigh: 6 }, { floor: true }),
  },
  {
    id: 'hspu-secondary',
    name: 'Wall-assisted HSPU',
    day: 'thu',
    block: 'main',
    order: 3,
    metric: 'weightedReps',
    ladderId: 'hspu',
    tracked: true,
    restSeconds: OTHER_REST,
    cues: ['3–5 reps', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: HSPU_STOP,
    prescriptions: other({ repsLow: 3, repsHigh: 5 }, { floor: true }),
  },
  {
    id: 'fl-row-banded',
    name: 'Band-assisted front lever row',
    day: 'thu',
    block: 'main',
    order: 4,
    metric: 'reps',
    ladderId: 'frontLeverRow',
    tracked: true,
    restSeconds: STAR_REST,
    cues: ['★ 4–6 reps', 'rest 3–4 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['hips dropped', 'line broke to finish the rep'],
    prescriptions: star({ repsLow: 4, repsHigh: 6 }, { floor: false }),
  },
  {
    id: 'ring-curl-b',
    name: 'Ring curl',
    day: 'thu',
    block: 'main',
    order: 5,
    metric: 'reps',
    tracked: true,
    supersetId: 'thu-5',
    restSeconds: OTHER_REST,
    cues: ['8–12 reps', 'superset with the ring reverse fly', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: [],
    prescriptions: other({ repsLow: 8, repsHigh: 12 }, { floor: false }),
  },
  {
    id: 'ring-reverse-fly',
    name: 'Ring reverse fly',
    day: 'thu',
    block: 'main',
    order: 5,
    metric: 'reps',
    tracked: true,
    supersetId: 'thu-5',
    restSeconds: OTHER_REST,
    cues: ['10–15 reps', 'superset with the ring curl', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: [],
    prescriptions: other({ repsLow: 10, repsHigh: 15 }, { floor: false }),
  },
  {
    id: 'standing-ab-wheel',
    name: 'Standing rollout or hanging windshield wiper',
    day: 'thu',
    block: 'main',
    order: 6,
    metric: 'reps',
    ladderId: 'abWheel',
    tracked: true,
    restSeconds: OTHER_REST,
    coreFunction: 'anti-extension / rotation',
    cues: ['standing rollout 3–8 reps', 'or windshield wiper 6–8 per side', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['lumbar extended', 'hips sagged', 'swung'],
    prescriptions: other({ repsLow: 3, repsHigh: 8 }, { floor: false }),
  },

  // ==========================================================================
  // SATURDAY — MOBILITY + CORE. Floor: 1–4. Stretch intensity RPE 6–7.5.
  // ==========================================================================
  {
    id: 'flexa-cossack',
    name: 'Loaded Cossack squat',
    day: 'sat',
    block: 'main',
    order: 1,
    metric: 'weightedReps',
    ladderId: 'middleSplit',
    tracked: true,
    rpeScale: 'stretch',
    restSeconds: OTHER_REST,
    cues: ['5 per side', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: STRETCH_STOP,
    prescriptions: other({ repsLow: 5, repsHigh: 5, perSide: true }, { floor: true, rpe: STRETCH_RPE }),
  },
  {
    id: 'flexa-pancake-good-morning',
    name: 'Pancake good morning (3 s lowering)',
    day: 'sat',
    block: 'main',
    order: 2,
    metric: 'weightedReps',
    ladderId: 'pancake',
    tracked: true,
    rpeScale: 'stretch',
    restSeconds: OTHER_REST,
    cues: ['8 reps', '3 s lowering', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: STRETCH_STOP,
    prescriptions: other({ repsLow: 8, repsHigh: 8 }, { floor: true, rpe: STRETCH_RPE }),
  },
  {
    id: 'hanging-leg-raise-slow',
    name: 'Hanging leg raise (slow)',
    day: 'sat',
    block: 'main',
    order: 3,
    metric: 'reps',
    tracked: true,
    restSeconds: OTHER_REST,
    coreFunction: 'trunk flexion & compression',
    cues: ['6–10 reps', 'slow', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: [],
    prescriptions: other({ repsLow: 6, repsHigh: 10 }, { floor: true }),
  },
  {
    id: 'copenhagen-plank',
    name: 'Copenhagen plank',
    day: 'sat',
    block: 'main',
    order: 4,
    metric: 'hold',
    tracked: true,
    restSeconds: OTHER_REST,
    coreFunction: 'adductors / anti-lateral flexion',
    cues: ['20–30 s per side', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: [],
    prescriptions: other({ secLow: 20, secHigh: 30, perSide: true }, { floor: true }),
  },
  {
    id: 'flexb-hip-flexor-split',
    name: 'Hip flexor split stretch, rear glute squeezed',
    day: 'sat',
    block: 'main',
    order: 5,
    metric: 'hold',
    ladderId: 'frontSplit',
    tracked: true,
    rpeScale: 'stretch',
    restSeconds: OTHER_REST,
    cues: ['45 s per side', 'rear glute squeezed'],
    progressionLadder: PROGRESSION,
    stopRules: STRETCH_STOP,
    prescriptions: other({ secLow: 45, secHigh: 45, perSide: true }, { floor: false, sets: 2, rpe: STRETCH_RPE }),
  },
  {
    id: 'flexa-middle-split',
    name: 'Supported middle split / pancake contract-relax',
    day: 'sat',
    block: 'main',
    order: 6,
    metric: 'hold',
    ladderId: 'middleSplit',
    tracked: true,
    rpeScale: 'stretch',
    restSeconds: OTHER_REST,
    cues: ['60 s'],
    progressionLadder: PROGRESSION,
    stopRules: STRETCH_STOP,
    prescriptions: other({ secLow: 60, secHigh: 60 }, { floor: false, sets: 2, rpe: STRETCH_RPE }),
  },
  {
    id: 'flexb-front-split',
    name: 'Supported front split',
    day: 'sat',
    block: 'main',
    order: 7,
    metric: 'hold',
    ladderId: 'frontSplit',
    tracked: true,
    rpeScale: 'stretch',
    restSeconds: OTHER_REST,
    cues: ['45 s per side'],
    progressionLadder: PROGRESSION,
    stopRules: STRETCH_STOP,
    prescriptions: other({ secLow: 45, secHigh: 45, perSide: true }, { floor: false, sets: 2, rpe: STRETCH_RPE }),
  },
  {
    id: 'flexa-bench-shoulder',
    name: 'Bench shoulder-flexion stretch + active lift-offs',
    day: 'sat',
    block: 'main',
    order: 8,
    metric: 'hold',
    ladderId: 'handstandShoulder',
    tracked: true,
    rpeScale: 'stretch',
    restSeconds: OTHER_REST,
    cues: ['45 s stretch', 'then 6–8 active lift-offs'],
    progressionLadder: PROGRESSION,
    stopRules: STRETCH_STOP,
    prescriptions: other({ secLow: 45, secHigh: 45 }, { floor: false, sets: 2, rpe: STRETCH_RPE }),
  },
  {
    id: 'flexb-bridge',
    name: 'Bridge',
    day: 'sat',
    block: 'main',
    order: 9,
    metric: 'hold',
    ladderId: 'bridge',
    tracked: true,
    rpeScale: 'stretch',
    restSeconds: OTHER_REST,
    cues: ['20 s'],
    progressionLadder: PROGRESSION,
    stopRules: STRETCH_STOP,
    prescriptions: other({ secLow: 20, secHigh: 20 }, { floor: false, rpe: STRETCH_RPE }),
  },
  {
    id: 'pike-compression-lsit',
    name: 'Seated pike compression lift-off / L-sit',
    day: 'sat',
    block: 'main',
    order: 10,
    metric: 'hold',
    tracked: true,
    restSeconds: OTHER_REST,
    coreFunction: 'compression',
    cues: ['5–10 s', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: [],
    prescriptions: other({ secLow: 5, secHigh: 10 }, { floor: false, sets: 4 }),
  },
  {
    id: 'pallof-press',
    name: 'Pallof press or cable woodchop',
    day: 'sat',
    block: 'main',
    order: 11,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: OTHER_REST,
    coreFunction: 'anti-rotation / rotation',
    cues: ['8–10 per side', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: [],
    prescriptions: other({ repsLow: 8, repsHigh: 10, perSide: true }, { floor: false }),
  },
  {
    id: 'cable-crunch',
    name: 'Cable crunch',
    day: 'sat',
    block: 'main',
    order: 12,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: OTHER_REST,
    coreFunction: 'loaded spinal flexion',
    cues: ['10–12 reps', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['hips flexed instead of the spine'],
    prescriptions: other({ repsLow: 10, repsHigh: 12 }, { floor: false }),
  },

  // ==========================================================================
  // SUNDAY — LOWER (ATHLETIC). Floor: warm-up, 1, 2, 4.
  // ==========================================================================
  {
    id: 'sun-warmup',
    name: 'Warm-up — Cossacks, lunges with reach, A-skips, leg swings',
    day: 'sun',
    block: 'main',
    order: 0,
    metric: 'runInterval',
    tracked: true,
    rpeScale: 'run',
    cues: ['8 min'],
    progressionLadder: [],
    stopRules: [],
    // The table gives the warm-up a duration and no sets ("—"); one 8-minute
    // block every week, the floor included.
    prescriptions: [{ weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], sets: 1, minutesEach: 8 }],
  },
  {
    id: 'broad-jump',
    name: 'Broad jump',
    day: 'sun',
    block: 'main',
    order: 1,
    metric: 'reps',
    tracked: true,
    supersetId: 'sun-1',
    restSeconds: OTHER_REST,
    cues: ['3 reps', 'paired with the lateral bound', 'add 4–5 × 20 m sprints if a pitch is available'],
    progressionLadder: PROGRESSION,
    stopRules: [],
    prescriptions: other({ repsLow: 3, repsHigh: 3 }, { floor: true, sets: 4, setsNote: '3–4 sets' }),
  },
  {
    id: 'lateral-bound',
    name: 'Lateral bound',
    day: 'sun',
    block: 'main',
    order: 1,
    metric: 'reps',
    tracked: true,
    supersetId: 'sun-1',
    restSeconds: OTHER_REST,
    cues: ['3 per side', 'paired with the broad jump'],
    progressionLadder: PROGRESSION,
    stopRules: [],
    prescriptions: other({ repsLow: 3, repsHigh: 3, perSide: true }, { floor: true, sets: 4, setsNote: '3–4 sets' }),
  },
  {
    id: 'trap-bar-deadlift',
    name: 'Trap bar deadlift (or hack squat 6–8)',
    day: 'sun',
    block: 'main',
    order: 2,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: STAR_REST,
    cues: ['★ 4–6 reps', 'or hack squat for 6–8', 'rest 3–4 min'],
    progressionLadder: PROGRESSION,
    stopRules: [],
    prescriptions: star({ repsLow: 4, repsHigh: 6 }, { floor: true }),
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Deep rear-foot-elevated split squat',
    day: 'sun',
    block: 'main',
    order: 3,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: STAR_REST,
    cues: ['★ 6–8 reps per side', 'rest 3–4 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['depth reduced', 'balance lost'],
    prescriptions: star({ repsLow: 6, repsHigh: 8, perSide: true }, { floor: false }),
  },
  {
    id: 'nordic-curl',
    name: 'Nordic hamstring curl',
    day: 'sun',
    block: 'main',
    order: 4,
    metric: 'reps',
    ladderId: 'nordic',
    tracked: true,
    restSeconds: OTHER_REST,
    cues: ['4–6 reps', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['hips piked to shorten the lever', 'dropped through the last third'],
    prescriptions: other({ repsLow: 4, repsHigh: 6 }, { floor: true }),
  },
  {
    id: 'calf-raise-b',
    name: 'Bent-knee calf raise (2 s pause)',
    day: 'sun',
    block: 'main',
    order: 5,
    metric: 'weightedReps',
    tracked: true,
    supersetId: 'sun-5',
    restSeconds: OTHER_REST,
    cues: ['10–15 reps', '2 s pause', 'superset with the tibialis raise'],
    progressionLadder: PROGRESSION,
    stopRules: ['pause skipped', 'ROM shortened'],
    prescriptions: other({ repsLow: 10, repsHigh: 15 }, { floor: false }),
  },
  {
    id: 'tibialis-raise',
    name: 'Tibialis raise',
    day: 'sun',
    block: 'main',
    order: 5,
    metric: 'reps',
    tracked: true,
    supersetId: 'sun-5',
    restSeconds: OTHER_REST,
    cues: ['15–20 reps', 'superset with the calf raise', 'rest 2 min'],
    progressionLadder: PROGRESSION,
    stopRules: ['ROM shortened'],
    prescriptions: other({ repsLow: 15, repsHigh: 20 }, { floor: false }),
  },
];
