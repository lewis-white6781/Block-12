// THE 12-WEEK CALISTHENICS-PRIORITY CUT — SPEC-V5.0.md sections 2, 4 and the
// per-day tables. Push / Pull / Legs / Rest / Push / Pull / Rest.
//
// Transcribed exactly from updatedblock20.md. Do not invent, round, or
// paraphrase any prescription. Every weekly sets/RPE table is authored here one
// Prescription per row, so a week is never inferred. Where the plan states one
// table and then says "progress exactly as Monday" or "same strict rules as
// Monday", the table is a shared constant rather than a retyped copy, so the
// two cannot drift apart.
//
// Conventions worth knowing before editing:
//
//   - `sets: 0` means "not prescribed this week" and `exercisesFor` drops it.
//     Nothing in v5.0 needs it — every exercise runs all twelve weeks — but the
//     mechanism stays for the next block that does.
//   - A range on a field the type stores as ONE number (sets, minutes) takes
//     the high end and records the range in `note`. Reps, seconds and RPE
//     ranges are native (`repsLow`/`repsHigh` etc.) and need no note.
//   - The exercises are FIXED across the block. Reps, hold durations and
//     exercise selection do not change; sets, RPE, cardio duration and
//     flexibility volume do. Load, leverage, ROM and band assistance are the
//     athlete's dials for hitting the prescribed RPE.
import type { Block, DayId, Exercise, Prescription } from '../domain/types';

/** The name of each session, one per (day, block). */
export const sessionTitles: Record<DayId, Partial<Record<Block, string>>> = {
  mon: {
    am: 'Handstand grease the groove',
    main: 'Push A — HSPU priority',
    later: 'Moderate continuous cardio',
  },
  tue: {
    main: 'Pull A — primary front lever',
  },
  wed: {
    am: 'Front lever grease the groove',
    main: 'Legs',
  },
  thu: {
    later: 'Flexibility A — pancake, middle split, shoulders',
  },
  fri: {
    am: 'Handstand grease the groove',
    main: 'Push B — weighted dip priority',
    later: 'HIIT',
  },
  sat: {
    main: 'Pull B — weighted pull + FL support',
  },
  sun: {
    main: 'Long low-intensity cardio',
    later: 'Flexibility B — front split, pike, bridge, ankle',
  },
};

/**
 * A short name for the whole day, for the places that need to say which day an
 * exercise belongs to without room for the full session title — the Today
 * header, the Progress exercise picker.
 */
export const dayTitles: Record<DayId, string> = {
  mon: 'Push A',
  tue: 'Pull A',
  wed: 'Legs',
  thu: 'Rest + Flexibility A',
  fri: 'Push B',
  sat: 'Pull B',
  sun: 'Active recovery',
};

// ---------------------------------------------------------------------------
// Weekly tables
// ---------------------------------------------------------------------------

/** One row of a weekly sets/RPE table: [sets, rpeLow, rpeHigh, note?]. */
type WeekRow = [sets: number, rpeLow: number, rpeHigh: number, note?: string];

/** Expands a 12-row table into one Prescription per week, plus constant fields. */
function weekly(rows: WeekRow[], fields: Omit<Prescription, 'weeks' | 'sets' | 'rpeLow' | 'rpeHigh' | 'note'>): Prescription[] {
  if (rows.length !== 12) throw new Error(`weekly(): expected 12 rows, got ${rows.length}`);
  return rows.map(([sets, rpeLow, rpeHigh, note], i) => ({
    weeks: [i + 1],
    sets,
    rpeLow,
    rpeHigh,
    ...fields,
    ...(note ? { note } : {}),
  }));
}

/**
 * The grease-the-groove rounds table, shared by all three GTG blocks — one
 * round is the whole list, so "sets" on each item IS the round count.
 * SPEC-V5.0.md: 2, 2, 2, 3, 3, 1, 2, 2, 3, 3, 2, 1–2.
 */
const GTG_ROUNDS = [2, 2, 2, 3, 3, 1, 2, 2, 3, 3, 2, 2];
const GTG_NOTES: Record<number, string> = { 12: '1–2 rounds' };

function gtgPrescriptions(fields: {
  repsLow?: number;
  repsHigh?: number;
  secLow?: number;
  secHigh?: number;
  rpeLow?: number;
  rpeHigh?: number;
  note?: string;
}): Prescription[] {
  return GTG_ROUNDS.map((sets, i) => ({
    weeks: [i + 1],
    sets,
    ...fields,
    ...(GTG_NOTES[i + 1] ? { note: GTG_NOTES[i + 1] } : {}),
  }));
}

/**
 * Weighted ring dip — the same table on Monday (Push A) and Friday (Push B).
 * The plan states it once and says "Progress exactly as Monday".
 */
const RING_DIP: WeekRow[] = [
  [4, 8, 8],
  [4, 8, 8],
  [4, 8, 8],
  [5, 8.5, 8.5],
  [5, 8.5, 8.5],
  [2, 6, 7],
  [4, 8, 8],
  [4, 8, 8],
  [5, 8.5, 8.5],
  [5, 8.5, 8.5],
  [4, 8.5, 8.5],
  [3, 7, 8, '2–3 sets'],
];

/**
 * The upper-body accessory table: strict lateral raise (both days), overhead
 * triceps extension, rear-delt fly, back-to-wall curl, triceps pressdown and
 * hammer curl all carry this exact table in the plan.
 */
const ACCESSORY: WeekRow[] = [
  [3, 8, 8],
  [3, 8, 8],
  [3, 8.5, 8.5],
  [4, 8.5, 8.5],
  [4, 9, 9],
  [2, 6, 7],
  [3, 8, 8],
  [3, 8.5, 8.5],
  [4, 8.5, 8.5],
  [4, 9, 9],
  [3, 9, 9],
  [2, 7, 8],
];

/**
 * The lower-body / core table: Bulgarian split squat, Nordic curl, seated calf
 * raise, tibialis raise and windshield wiper all carry this exact table.
 */
const LOWER: WeekRow[] = [
  [3, 8, 8],
  [3, 8, 8],
  [3, 8, 8],
  [4, 8.5, 8.5],
  [4, 8.5, 8.5],
  [2, 6, 6],
  [3, 8, 8],
  [3, 8, 8],
  [4, 8.5, 8.5],
  [4, 8.5, 8.5],
  [3, 8.5, 8.5],
  [2, 7, 7],
];

/**
 * Flexibility A prescribes TWO set counts per week — one for the loaded
 * movements (Cossack, pancake good morning, lift-off) and one for the static
 * holds (contract-relax, middle split, bench shoulder stretch) — against a
 * single RPE. Flexibility B prescribes one set count for everything.
 *
 * Flexibility RPE is the 5–8 scale (SPEC-V5.0.md section 2); 8+ is not
 * required anywhere in the block.
 */
interface FlexWeek {
  sets: number;
  rpeLow: number;
  rpeHigh: number;
  note?: string;
}

// Flexibility A — loaded movements: 2,2,3,3,3,1–2,2,3,3,3,3,1–2 + benchmark.
const FLEX_A_LOADED: FlexWeek[] = [
  { sets: 2, rpeLow: 6, rpeHigh: 6 },
  { sets: 2, rpeLow: 6, rpeHigh: 6.5 },
  { sets: 3, rpeLow: 6.5, rpeHigh: 6.5 },
  { sets: 3, rpeLow: 7, rpeHigh: 7 },
  { sets: 3, rpeLow: 7, rpeHigh: 7 },
  { sets: 2, rpeLow: 5, rpeHigh: 6, note: '1–2 sets' },
  { sets: 2, rpeLow: 6.5, rpeHigh: 6.5 },
  { sets: 3, rpeLow: 7, rpeHigh: 7 },
  { sets: 3, rpeLow: 7, rpeHigh: 7 },
  { sets: 3, rpeLow: 7, rpeHigh: 7.5 },
  { sets: 3, rpeLow: 7, rpeHigh: 7.5 },
  { sets: 2, rpeLow: 6, rpeHigh: 6, note: '1–2 sets + benchmark' },
];

// Flexibility A — static holds: 2,2,2,2,3,1–2,2,2,3,3,2,1–2 + benchmark.
const FLEX_A_STATIC: FlexWeek[] = [
  { sets: 2, rpeLow: 6, rpeHigh: 6 },
  { sets: 2, rpeLow: 6, rpeHigh: 6.5 },
  { sets: 2, rpeLow: 6.5, rpeHigh: 6.5 },
  { sets: 2, rpeLow: 7, rpeHigh: 7 },
  { sets: 3, rpeLow: 7, rpeHigh: 7 },
  { sets: 2, rpeLow: 5, rpeHigh: 6, note: '1–2 sets' },
  { sets: 2, rpeLow: 6.5, rpeHigh: 6.5 },
  { sets: 2, rpeLow: 7, rpeHigh: 7 },
  { sets: 3, rpeLow: 7, rpeHigh: 7 },
  { sets: 3, rpeLow: 7, rpeHigh: 7.5 },
  { sets: 2, rpeLow: 7, rpeHigh: 7.5 },
  { sets: 2, rpeLow: 6, rpeHigh: 6, note: '1–2 sets + benchmark' },
];

// Flexibility B — sets each: 2,2,2,3,3,1,2,2–3,3,3,2–3,1–2 + benchmark.
const FLEX_B_WEEKS: FlexWeek[] = [
  { sets: 2, rpeLow: 6, rpeHigh: 6 },
  { sets: 2, rpeLow: 6, rpeHigh: 6.5 },
  { sets: 2, rpeLow: 6.5, rpeHigh: 6.5 },
  { sets: 3, rpeLow: 7, rpeHigh: 7 },
  { sets: 3, rpeLow: 7, rpeHigh: 7 },
  { sets: 1, rpeLow: 5, rpeHigh: 6 },
  { sets: 2, rpeLow: 6.5, rpeHigh: 6.5 },
  { sets: 3, rpeLow: 7, rpeHigh: 7, note: '2–3 sets' },
  { sets: 3, rpeLow: 7, rpeHigh: 7 },
  { sets: 3, rpeLow: 7, rpeHigh: 7.5 },
  { sets: 3, rpeLow: 7, rpeHigh: 7.5, note: '2–3 sets' },
  { sets: 2, rpeLow: 6, rpeHigh: 6, note: '1–2 sets + benchmark' },
];

interface FlexItem {
  id: string;
  name: string;
  order: number;
  metric: 'hold' | 'reps' | 'weightedReps';
  ladderId?: string;
  repsLow?: number;
  repsHigh?: number;
  secLow?: number;
  secHigh?: number;
  perSide?: boolean;
  cues?: string[];
  overload: string; // the plan's overload rule for this item
}

/** Builds one flexibility exercise against a session's weekly table. */
function flexibilityExercise(day: DayId, weeks: FlexWeek[]) {
  return (item: FlexItem): Exercise => {
    const dose =
      item.secLow !== undefined
        ? item.secHigh !== undefined && item.secHigh !== item.secLow
          ? `${item.secLow}–${item.secHigh} s`
          : `${item.secLow} s`
        : item.repsHigh !== undefined && item.repsHigh !== item.repsLow
          ? `${item.repsLow}–${item.repsHigh} reps`
          : `${item.repsLow} reps`;
    return {
      id: item.id,
      name: item.name,
      day,
      block: 'later',
      order: item.order,
      metric: item.metric,
      ladderId: item.ladderId,
      tracked: true,
      rpeScale: 'stretch',
      cues: [
        `${dose}${item.perSide ? ' per side' : ''}`,
        ...(item.cues ?? []),
        'progress ROM → control → load, never pain tolerance',
      ],
      progressionLadder: [item.overload],
      stopRules: ['spine compensated excessively', 'joint felt pinched', 'active control disappeared'],
      prescriptions: weeks.map((week, i) => ({
        weeks: [i + 1],
        sets: week.sets,
        ...(item.repsLow !== undefined ? { repsLow: item.repsLow, repsHigh: item.repsHigh ?? item.repsLow } : {}),
        ...(item.secLow !== undefined ? { secLow: item.secLow, secHigh: item.secHigh ?? item.secLow } : {}),
        rpeLow: week.rpeLow,
        rpeHigh: week.rpeHigh,
        ...(item.perSide ? { perSide: true } : {}),
        ...(week.note ? { note: week.note } : {}),
      })),
    };
  };
}

// The plan's "technical failure" definitions for calisthenics skill work —
// the set ends when the standard breaks, not when gravity wins.
const FL_STOP = ['hips dropped below shoulder line', 'scapular position collapsed', 'elbows bent'];
const HSPU_STOP = ['ROM shortened', 'line collapsed', 'needed momentum'];
const DIP_STOP = ['lost stable depth', 'lost full lockout', 'rings drifted or bounced'];

export const program: Exercise[] = [
  // ==========================================================================
  // MONDAY AM — HANDSTAND GREASE THE GROOVE
  //
  // ~6–10 min, RPE 4–5 maximum, ideally 4–6+ hours before Push A. Progress by
  // better wall line, smaller toe contact, cleaner catches — never by making it
  // exhausting. Stop while attempts still feel crisp.
  // ==========================================================================
  {
    id: 'mon-am-wrist-lean',
    name: 'Wrist lean',
    day: 'mon',
    block: 'am',
    order: 1,
    metric: 'timeOnly',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['20 s @ RPE 4', 'gentle load into the wrists before any handstand work'],
    progressionLadder: ['greater wrist extension', 'more load through the palm'],
    stopRules: ['wrist pain rather than stretch'],
    prescriptions: gtgPrescriptions({ secLow: 20, secHigh: 20, rpeLow: 4, rpeHigh: 4 }),
  },
  {
    id: 'mon-am-chest-to-wall',
    name: 'Chest-to-wall handstand',
    day: 'mon',
    block: 'am',
    order: 2,
    metric: 'timeOnly',
    ladderId: 'handstandBalance',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['20 s @ RPE 4', 'ribs in, glutes on, push tall through the shoulders'],
    progressionLadder: ['better wall line', 'smaller toe contact'],
    stopRules: ['line collapsed', 'shoulders sagged'],
    prescriptions: gtgPrescriptions({ secLow: 20, secHigh: 20, rpeLow: 4, rpeHigh: 4 }),
  },
  {
    id: 'mon-am-toe-pulls',
    name: 'Toe pulls',
    day: 'mon',
    block: 'am',
    order: 3,
    metric: 'attempts',
    ladderId: 'handstandBalance',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['2 controlled attempts', 'pull the toes off the wall and hold the balance'],
    progressionLadder: ['cleaner 1–3 s catches', 'repeated 3–5 s catches'],
    stopRules: ['attempts stopped feeling crisp'],
    prescriptions: gtgPrescriptions({ repsLow: 2, repsHigh: 2, rpeLow: 4, rpeHigh: 5 }),
  },
  {
    id: 'mon-am-fingertip-shifts',
    name: 'Fingertip pressure shifts',
    day: 'mon',
    block: 'am',
    order: 4,
    metric: 'reps',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['6 reps', 'shift weight into the fingertips and back without the line moving'],
    progressionLadder: ['better fingertip correction'],
    stopRules: ['line moved with the shift'],
    prescriptions: gtgPrescriptions({ repsLow: 6, repsHigh: 6, rpeLow: 4, rpeHigh: 5 }),
  },
  {
    id: 'mon-am-max-elevation-hold',
    name: 'Elevated / scapular handstand hold',
    day: 'mon',
    block: 'am',
    order: 5,
    metric: 'timeOnly',
    ladderId: 'handstandBalance',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['10 s', 'push as tall as possible through the shoulders'],
    progressionLadder: ['greater elevation', 'longer clean hold'],
    stopRules: ['elevation lost'],
    prescriptions: gtgPrescriptions({ secLow: 10, secHigh: 10, rpeLow: 4, rpeHigh: 5 }),
  },

  // ==========================================================================
  // MONDAY — PUSH A: HSPU PRIORITY
  // ==========================================================================
  {
    id: 'hspu-primary',
    name: 'Deficit / elevated pike HSPU',
    day: 'mon',
    block: 'main',
    order: 1,
    metric: 'weightedReps',
    ladderId: 'hspu',
    tracked: true,
    restSeconds: 270,
    cues: ['4–6 reps', 'rest 4–5 min', 'primary concentric HSPU strength'],
    // "When all sets reach 6 technically excellent reps below the target RPE,
    // progress one variable." Never increase ROM and load at the same time.
    progressionLadder: [
      'increase deficit slightly',
      'raise feet',
      'shift shoulders farther over hands',
      'progress toward partial-ROM wall HSPU',
    ],
    stopRules: HSPU_STOP,
    prescriptions: weekly(
      [
        [4, 8, 8],
        [4, 8, 8],
        [4, 8.5, 8.5],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [3, 6, 7, '2–3 sets'],
        [4, 8, 8],
        [4, 8.5, 8.5],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [4, 8.5, 9],
        [3, 7, 8, '2–3 sets'],
      ],
      { repsLow: 4, repsHigh: 6 },
    ),
  },
  {
    id: 'ring-dip',
    name: 'Weighted ring dip',
    day: 'mon',
    block: 'main',
    order: 2,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 270,
    cues: ['4–6 reps', 'rest 4–5 min', 'controlled depth, stable rings, no bounce, full lockout'],
    // "When every work set reaches 6 reps at or below target RPE, add the
    // smallest practical load increase — usually ~1.25–2.5 kg total."
    progressionLadder: ['6 clean reps on every set', 'add 1.25–2.5 kg'],
    stopRules: DIP_STOP,
    prescriptions: weekly(RING_DIP, { repsLow: 4, repsHigh: 6 }),
  },
  {
    id: 'lateral-raise',
    name: 'Strict dumbbell lateral raise',
    day: 'mon',
    block: 'main',
    order: 3,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 150,
    cues: ['10–15 reps', 'rest 2–3 min', 'no leg drive, minimal torso movement, no shrug, controlled eccentric'],
    // "Reach 15 clean reps before increasing weight. If the dumbbell jump is
    // large, allow reps to return to ~10–12."
    progressionLadder: ['15 clean reps', 'increase weight, reps return to 10–12'],
    stopRules: ['leg drive appeared', 'shrugged', 'torso swung'],
    prescriptions: weekly(ACCESSORY, { repsLow: 10, repsHigh: 15 }),
  },
  {
    id: 'overhead-triceps-ext',
    name: 'Overhead cable triceps extension',
    day: 'mon',
    block: 'main',
    order: 4,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 150,
    cues: ['8–12 reps', 'rest 2–3 min', 'strict elbow position'],
    progressionLadder: ['12 reps on all work sets with strict elbows', 'increase the stack by the smallest increment'],
    stopRules: ['elbows flared', 'shoulders took over'],
    prescriptions: weekly(ACCESSORY, { repsLow: 8, repsHigh: 12 }),
  },
  {
    id: 'dragon-flag',
    name: 'Dragon flag',
    day: 'mon',
    block: 'main',
    order: 5,
    metric: 'reps',
    ladderId: 'dragonFlag',
    tracked: true,
    restSeconds: 240,
    coreFunction: 'long-lever anti-extension',
    cues: ['4–6 reps', 'rest 3–5 min', '~3 s eccentric', 'lats anchor the body; this is core work, not a pull'],
    progressionLadder: [
      'bent-knee / shorter lever',
      'single-leg',
      'full eccentric',
      'full concentric + eccentric',
      'slower full reps',
      'small external load',
    ],
    stopRules: ['lumbar arched', 'body piked at the hips', 'eccentric sped up'],
    prescriptions: weekly(
      [
        [3, 8, 8],
        [3, 8, 8],
        [3, 8, 8],
        [4, 8.5, 8.5],
        [4, 8.5, 8.5],
        [2, 6, 7],
        [3, 8, 8],
        [3, 8.5, 8.5],
        [4, 8.5, 8.5],
        [4, 8.5, 8.5],
        [3, 8.5, 8.5],
        [2, 7, 8],
      ],
      { repsLow: 4, repsHigh: 6 },
    ),
  },

  // ==========================================================================
  // MONDAY LATER — MODERATE CONTINUOUS CARDIO
  //
  // The 20–30 minute faster continuous session, RPE 5.5–6.5: clearly above easy
  // Zone 2, conversation limited to short phrases, effort still controlled.
  // After Push A or 4–6+ hours later, never before lifting. Bike, elliptical,
  // rower or incline treadmill preferred to spare Wednesday's legs. Progress
  // DURATION first, not speed.
  // ==========================================================================
  {
    id: 'mon-moderate-cardio',
    name: 'Moderate continuous cardio',
    day: 'mon',
    block: 'later',
    order: 1,
    metric: 'runInterval',
    tracked: true,
    rpeScale: 'run',
    cues: [
      '5 min easy warm-up @ RPE 2–3, then the prescribed continuous work, then 3–5 min easy cooldown',
      'bike, elliptical, rower or incline treadmill preferred; an easy/moderate run if you like',
      'breathing is harder and talk is short phrases, but the effort stays controlled',
    ],
    progressionLadder: ['longer duration at the same RPE', 'more output at the same RPE'],
    stopRules: ['effort drifted above the prescribed RPE'],
    prescriptions: [
      { weeks: [1], sets: 1, minutesEach: 20, rpeLow: 5.5, rpeHigh: 5.5 },
      { weeks: [2], sets: 1, minutesEach: 22, rpeLow: 5.5, rpeHigh: 6 },
      { weeks: [3], sets: 1, minutesEach: 24, rpeLow: 6, rpeHigh: 6 },
      { weeks: [4], sets: 1, minutesEach: 26, rpeLow: 6, rpeHigh: 6 },
      { weeks: [5], sets: 1, minutesEach: 28, rpeLow: 6, rpeHigh: 6.5 },
      { weeks: [6], sets: 1, minutesEach: 18, rpeLow: 4, rpeHigh: 5, note: '15–18 min' },
      { weeks: [7], sets: 1, minutesEach: 24, rpeLow: 6, rpeHigh: 6 },
      { weeks: [8], sets: 1, minutesEach: 26, rpeLow: 6, rpeHigh: 6 },
      { weeks: [9], sets: 1, minutesEach: 28, rpeLow: 6, rpeHigh: 6.5 },
      { weeks: [10], sets: 1, minutesEach: 30, rpeLow: 6, rpeHigh: 6.5 },
      { weeks: [11], sets: 1, minutesEach: 30, rpeLow: 6.5, rpeHigh: 6.5 },
      { weeks: [12], sets: 1, minutesEach: 25, rpeLow: 5, rpeHigh: 6, note: '20–25 min' },
    ],
  },

  // ==========================================================================
  // TUESDAY — PULL A: PRIMARY FRONT-LEVER SESSION
  // ==========================================================================
  {
    id: 'fl-hold-primary',
    name: 'Hard front-lever isometric',
    day: 'tue',
    block: 'main',
    order: 1,
    metric: 'hold',
    ladderId: 'frontLever',
    tracked: true,
    restSeconds: 270,
    cues: [
      '5–8 s hold',
      'rest 4–5 min',
      'likely starting options: open advanced tuck, one-leg, or lightly band-assisted straddle/full',
      'never count seconds after hip height or scapular position collapses',
    ],
    // "When you can hold the position for 8 sec with ~2 clean seconds still
    // available", progress one step.
    progressionLadder: ['open the tuck further', 'move to one-leg', 'reduce band assistance', 'progress toward straddle/full'],
    stopRules: FL_STOP,
    prescriptions: weekly(
      [
        [4, 8, 8],
        [4, 8, 8],
        [4, 8, 8],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [2, 6, 6],
        [4, 8, 8],
        [4, 8.5, 8.5],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [4, 8.5, 9],
        [3, 7, 7, '2–3 sets, then optional benchmark'],
      ],
      { secLow: 5, secHigh: 8 },
    ),
  },
  {
    id: 'fl-raise',
    name: 'Front-lever raise',
    day: 'tue',
    block: 'main',
    order: 2,
    metric: 'reps',
    ladderId: 'frontLever',
    tracked: true,
    restSeconds: 270,
    cues: ['4–6 reps', 'rest 4–5 min', 'elbows locked', 'use the hardest leverage that permits locked elbows and no hip pike'],
    progressionLadder: ['advanced tuck', 'open advanced tuck', 'one-leg', 'straddle', 'assisted full'],
    stopRules: ['elbows bent', 'hips piked', 'momentum from the swing'],
    prescriptions: weekly(
      [
        [4, 8, 8],
        [4, 8, 8],
        [4, 8, 8],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [2, 6, 7],
        [4, 8, 8],
        [4, 8.5, 8.5],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [4, 8.5, 8.5],
        [3, 7, 8, '2–3 sets'],
      ],
      { repsLow: 4, repsHigh: 6 },
    ),
  },
  {
    id: 'rear-delt-fly',
    name: 'Reverse pec deck / cable rear-delt fly',
    day: 'tue',
    block: 'main',
    order: 3,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 150,
    cues: ['10–15 reps', 'rest 2–3 min', 'rear delts, not traps — do not turn it into a row'],
    progressionLadder: ['15 clean reps', 'add load'],
    stopRules: ['turned into a trap-dominant row'],
    prescriptions: weekly(ACCESSORY, { repsLow: 10, repsHigh: 15 }),
  },
  {
    id: 'wall-curl',
    name: 'Strict back-to-wall curl',
    day: 'tue',
    block: 'main',
    order: 4,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 150,
    cues: ['8–12 reps', 'rest 2–3 min', 'back and glutes stay on the wall, upper arms nearly fixed, no hip drive or torso swing'],
    progressionLadder: ['12 reps on all work sets at target RPE', 'increase load'],
    stopRules: ['back left the wall', 'upper arms swung', 'hips drove'],
    prescriptions: weekly(ACCESSORY, { repsLow: 8, repsHigh: 12 }),
  },
  {
    id: 'standing-ab-wheel',
    name: 'Standing ab wheel / standing ring rollout',
    day: 'tue',
    block: 'main',
    order: 5,
    metric: 'reps',
    ladderId: 'abWheel',
    tracked: true,
    restSeconds: 210,
    coreFunction: 'dynamic anti-extension',
    cues: ['3–8 reps', 'rest 3–4 min', 'do not let lumbar extension substitute for abdominal control'],
    progressionLadder: ['standing rollout to high target', 'lower target', 'longer extension', 'full standing rollout', 'paused full rollout'],
    stopRules: ['lumbar extended', 'hips sagged'],
    prescriptions: weekly(
      [
        [3, 8, 8],
        [3, 8, 8],
        [3, 8, 8],
        [4, 8.5, 8.5],
        [4, 8.5, 8.5],
        [2, 6, 6],
        [3, 8, 8],
        [3, 8.5, 8.5],
        [4, 8.5, 8.5],
        [4, 8.5, 8.5],
        [3, 8.5, 8.5],
        [2, 7, 8],
      ],
      { repsLow: 3, repsHigh: 8 },
    ),
  },

  // ==========================================================================
  // WEDNESDAY AM — FRONT-LEVER GREASE THE GROOVE
  //
  // 6–10 min, RPE 4–5. Use more assistance than you think you need — the
  // session should not create soreness.
  // ==========================================================================
  {
    id: 'wed-am-active-hang',
    name: 'Active hang',
    day: 'wed',
    block: 'am',
    order: 1,
    metric: 'reps',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['5 reps', 'depress and retract the scapulae, elbows locked'],
    progressionLadder: ['fuller scapular range'],
    stopRules: ['elbows bent'],
    prescriptions: gtgPrescriptions({ repsLow: 5, repsHigh: 5, rpeLow: 4, rpeHigh: 5 }),
  },
  {
    id: 'wed-am-band-fl-hold',
    name: 'Heavy-band full-shape front lever',
    day: 'wed',
    block: 'am',
    order: 2,
    metric: 'timeOnly',
    ladderId: 'frontLever',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['5 s', 'full shape with a heavy band — more assistance than you think you need'],
    progressionLadder: ['cleaner horizontal line', 'lighter band'],
    stopRules: ['hips sagged', 'session created soreness'],
    prescriptions: gtgPrescriptions({ secLow: 5, secHigh: 5, rpeLow: 4, rpeHigh: 5 }),
  },
  {
    id: 'wed-am-scap-pull',
    name: 'Straight-arm scapular pull',
    day: 'wed',
    block: 'am',
    order: 3,
    metric: 'reps',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['5 reps', 'elbows locked throughout'],
    progressionLadder: ['greater scapular range'],
    stopRules: ['elbows bent'],
    prescriptions: gtgPrescriptions({ repsLow: 5, repsHigh: 5, rpeLow: 4, rpeHigh: 5 }),
  },
  {
    id: 'wed-am-band-fl-raise',
    name: 'Easy band-assisted front lever raise',
    day: 'wed',
    block: 'am',
    order: 4,
    metric: 'reps',
    ladderId: 'frontLever',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['2 reps', 'easy — this is a groove, not a work set'],
    progressionLadder: ['cleaner line', 'lighter band'],
    stopRules: ['elbows bent', 'hips piked'],
    prescriptions: gtgPrescriptions({ repsLow: 2, repsHigh: 2, rpeLow: 4, rpeHigh: 5 }),
  },

  // ==========================================================================
  // WEDNESDAY — LEGS
  // Three serious exercises + two low-cost lower-leg movements.
  // ==========================================================================
  {
    id: 'hack-squat',
    name: 'Hack squat / pendulum squat',
    day: 'wed',
    block: 'main',
    order: 1,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 270,
    cues: ['6–8 reps', 'rest 4–5 min', 'use the deepest ROM you can control consistently'],
    // "Reach 8 reps across all work sets at target RPE, then add the smallest
    // practical load and return toward 6 reps."
    progressionLadder: ['8 reps on all work sets', 'add the smallest load, return toward 6 reps'],
    stopRules: ['depth reduced', 'knees caved'],
    prescriptions: weekly(
      [
        [4, 8, 8],
        [4, 8, 8],
        [4, 8, 8],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [2, 6, 7],
        [4, 8, 8],
        [4, 8, 8],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [4, 8.5, 8.5],
        [3, 7, 8, '2–3 sets'],
      ],
      { repsLow: 6, repsHigh: 8 },
    ),
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Deep Bulgarian split squat',
    day: 'wed',
    block: 'main',
    order: 2,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 240,
    cues: ['6–8 reps per leg', 'rest 3–5 min', 'do not sacrifice depth to add weight'],
    progressionLadder: ['greater controlled depth', 'better stability', 'reach 8 reps', 'add dumbbell load'],
    stopRules: ['depth reduced', 'balance lost'],
    prescriptions: weekly(LOWER, { repsLow: 6, repsHigh: 8, perSide: true }),
  },
  {
    id: 'nordic-curl',
    name: 'Nordic hamstring curl',
    day: 'wed',
    block: 'main',
    order: 3,
    metric: 'reps',
    ladderId: 'nordic',
    tracked: true,
    restSeconds: 270,
    cues: ['4–6 reps', 'rest 4–5 min'],
    progressionLadder: [
      'assisted eccentric',
      'assisted full rep',
      'reduce assistance',
      'full eccentric + partial concentric',
      'full Nordic',
      'slower full Nordic',
      'light external load',
    ],
    stopRules: ['hips piked to shorten the lever', 'dropped through the last third'],
    prescriptions: weekly(LOWER, { repsLow: 4, repsHigh: 6 }),
  },
  {
    id: 'calf-raise-b',
    name: 'Seated calf raise',
    day: 'wed',
    block: 'main',
    order: 4,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 150,
    cues: ['10–15 reps', 'rest 2–3 min', '2 s pause at the bottom'],
    progressionLadder: ['15 full-ROM reps with the loaded stretch', 'add load'],
    stopRules: ['bottom pause skipped', 'ROM shortened'],
    prescriptions: weekly(LOWER, { repsLow: 10, repsHigh: 15 }),
  },
  {
    id: 'tibialis-raise',
    name: 'Tibialis raise',
    day: 'wed',
    block: 'main',
    order: 5,
    metric: 'reps',
    tracked: true,
    restSeconds: 120,
    cues: ['15–20 reps', 'rest 1.5–2.5 min'],
    progressionLadder: ['20 full-ROM reps', 'increase resistance'],
    stopRules: ['ROM shortened'],
    prescriptions: weekly(LOWER, { repsLow: 15, repsHigh: 20 }),
  },

  // ==========================================================================
  // THURSDAY LATER — FLEXIBILITY A: PANCAKE + MIDDLE SPLIT + HANDSTAND SHOULDER
  //
  // Thursday is a rest day; this is its only session. Start with 3–5 min of
  // easy movement if cold. Loaded movements and static holds run on separate
  // set tables (see FLEX_A_LOADED / FLEX_A_STATIC).
  // ==========================================================================
  ...[
    {
      id: 'flexa-cossack',
      name: 'Loaded Cossack squat',
      order: 1,
      metric: 'weightedReps' as const,
      ladderId: 'middleSplit',
      repsLow: 5,
      perSide: true,
      overload: 'deeper ROM, then more load',
    },
    {
      id: 'flexa-pancake-good-morning',
      name: 'Loaded pancake good morning',
      order: 2,
      metric: 'weightedReps' as const,
      ladderId: 'pancake',
      repsLow: 8,
      cues: ['3–4 s eccentric', '1–2 s bottom control', 'hinge from the hips'],
      overload: 'chest closer to the floor, then modest load',
    },
    {
      id: 'flexa-wall-liftoff',
      name: 'Active shoulder lift-off',
      order: 6,
      metric: 'reps' as const,
      ladderId: 'handstandShoulder',
      repsLow: 6,
      repsHigh: 8,
      cues: ['2 s top hold'],
      overload: 'greater active range; eventually very light external load',
    },
  ].map(flexibilityExercise('thu', FLEX_A_LOADED)),
  ...[
    {
      id: 'flexa-pancake-contract-relax',
      name: 'Pancake contract-relax',
      order: 3,
      metric: 'hold' as const,
      ladderId: 'pancake',
      secLow: 45,
      secHigh: 60,
      overload: 'reduce torso-to-floor distance, not endless duration',
    },
    {
      id: 'flexa-middle-split',
      name: 'Supported middle split',
      order: 4,
      metric: 'hold' as const,
      ladderId: 'middleSplit',
      secLow: 45,
      secHigh: 60,
      overload: 'lower support, pelvis closer to the floor',
    },
    {
      id: 'flexa-bench-shoulder',
      name: 'Bench shoulder-flexion stretch',
      order: 5,
      metric: 'hold' as const,
      ladderId: 'handstandShoulder',
      secLow: 45,
      cues: ['ribs controlled', 'avoid lumbar compensation'],
      overload: 'more genuine shoulder flexion without rib flare',
    },
  ].map(flexibilityExercise('thu', FLEX_A_STATIC)),

  // ==========================================================================
  // FRIDAY AM — HANDSTAND GREASE THE GROOVE
  // RPE 4–5. Do not let the morning work reduce afternoon HSPU performance.
  // ==========================================================================
  {
    id: 'fri-am-wrist-lean',
    name: 'Wrist lean',
    day: 'fri',
    block: 'am',
    order: 1,
    metric: 'timeOnly',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['20 s', 'gentle load into the wrists before any handstand work'],
    progressionLadder: ['greater wrist extension', 'more load through the palm'],
    stopRules: ['wrist pain rather than stretch'],
    prescriptions: gtgPrescriptions({ secLow: 20, secHigh: 20, rpeLow: 4, rpeHigh: 5 }),
  },
  {
    id: 'fri-am-chest-to-wall',
    name: 'Chest-to-wall line',
    day: 'fri',
    block: 'am',
    order: 2,
    metric: 'timeOnly',
    ladderId: 'handstandBalance',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['20 s', 'ribs in, glutes on, push tall through the shoulders'],
    progressionLadder: ['better wall line', 'smaller toe contact'],
    stopRules: ['line collapsed', 'shoulders sagged'],
    prescriptions: gtgPrescriptions({ secLow: 20, secHigh: 20, rpeLow: 4, rpeHigh: 5 }),
  },
  {
    id: 'fri-am-toe-pulls',
    name: 'Toe pulls',
    day: 'fri',
    block: 'am',
    order: 3,
    metric: 'attempts',
    ladderId: 'handstandBalance',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['2 attempts'],
    progressionLadder: ['cleaner 1–3 s catches', 'repeated 3–5 s catches'],
    stopRules: ['attempts stopped feeling crisp'],
    prescriptions: gtgPrescriptions({ repsLow: 2, repsHigh: 2, rpeLow: 4, rpeHigh: 5 }),
  },
  {
    id: 'fri-am-fingertip-shifts',
    name: 'Fingertip pressure shifts',
    day: 'fri',
    block: 'am',
    order: 4,
    metric: 'reps',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['6 reps'],
    progressionLadder: ['better fingertip correction'],
    stopRules: ['line moved with the shift'],
    prescriptions: gtgPrescriptions({ repsLow: 6, repsHigh: 6, rpeLow: 4, rpeHigh: 5 }),
  },
  {
    id: 'fri-am-wall-release-catch',
    name: 'Controlled wall-release catch',
    day: 'fri',
    block: 'am',
    order: 5,
    metric: 'attempts',
    ladderId: 'handstandBalance',
    tracked: true,
    setsLabel: 'rounds',
    cues: ['1–2 attempts', 'release the wall and catch the balance under control'],
    progressionLadder: ['repeated 1–3 s catches', 'repeated 3–5 s catches', 'longer wall releases'],
    stopRules: ['attempts stopped feeling crisp'],
    prescriptions: gtgPrescriptions({ repsLow: 1, repsHigh: 2, rpeLow: 4, rpeHigh: 5 }),
  },

  // ==========================================================================
  // FRIDAY — PUSH B: WEIGHTED DIP PRIORITY
  // ==========================================================================
  {
    id: 'ring-dip-secondary',
    name: 'Weighted ring dip',
    day: 'fri',
    block: 'main',
    order: 1,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 270,
    cues: ['4–6 reps', 'rest 4–5 min', 'progress exactly as Monday'],
    progressionLadder: ['6 clean reps on every set', 'add 1.25–2.5 kg'],
    stopRules: DIP_STOP,
    prescriptions: weekly(RING_DIP, { repsLow: 4, repsHigh: 6 }),
  },
  {
    id: 'hspu-secondary',
    name: 'Wall-assisted HSPU',
    day: 'fri',
    block: 'main',
    order: 2,
    metric: 'weightedReps',
    ladderId: 'hspu',
    tracked: true,
    restSeconds: 270,
    cues: ['3–6 reps', 'rest 4–5 min', 'increase ROM before adding load'],
    progressionLadder: ['partial ROM', 'increase depth', 'full current setup', 'parallette deficit', 'reduce wall assistance over time'],
    stopRules: HSPU_STOP,
    prescriptions: weekly(
      [
        [3, 7.5, 8],
        [3, 8, 8],
        [3, 8, 8],
        [4, 8, 8],
        [4, 8.5, 8.5],
        [2, 6, 6],
        [3, 8, 8],
        [3, 8, 8],
        [4, 8.5, 8.5],
        [4, 8.5, 8.5],
        [3, 8.5, 8.5],
        [2, 7, 8],
      ],
      { repsLow: 3, repsHigh: 6 },
    ),
  },
  {
    id: 'lateral-raise-c',
    name: 'Strict dumbbell lateral raise',
    day: 'fri',
    block: 'main',
    order: 3,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 150,
    cues: ['10–15 reps', 'same strict rules as Monday'],
    progressionLadder: ['15 clean reps', 'increase weight, reps return to 10–12'],
    stopRules: ['leg drive appeared', 'shrugged', 'torso swung'],
    prescriptions: weekly(ACCESSORY, { repsLow: 10, repsHigh: 15 }),
  },
  {
    id: 'cable-triceps-ext',
    name: 'Cable triceps pressdown',
    day: 'fri',
    block: 'main',
    order: 4,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 150,
    cues: ['10–15 reps', 'rest 2–3 min'],
    progressionLadder: ['15 strict reps', 'add load'],
    stopRules: ['elbows drifted forward', 'shoulders took over'],
    prescriptions: weekly(ACCESSORY, { repsLow: 10, repsHigh: 15 }),
  },
  {
    id: 'cable-crunch',
    name: 'Cable crunch (5A)',
    day: 'fri',
    block: 'main',
    order: 5,
    metric: 'weightedReps',
    tracked: true,
    supersetId: 'fri-5',
    coreFunction: 'loaded spinal flexion',
    cues: ['8–15 reps', 'progress load while maintaining actual spinal flexion'],
    progressionLadder: ['15 reps with true spinal flexion', 'add load'],
    stopRules: ['hips flexed instead of the spine'],
    prescriptions: weekly(
      [
        [3, 8, 8],
        [3, 8, 8],
        [3, 8, 8],
        [4, 8.5, 8.5],
        [4, 8.5, 9],
        [2, 6, 6],
        [3, 8, 8],
        [3, 8, 8],
        [4, 8.5, 8.5],
        [4, 8.5, 9],
        [3, 8.5, 8.5],
        [2, 7, 7],
      ],
      { repsLow: 8, repsHigh: 15 },
    ),
  },
  {
    id: 'weighted-side-plank',
    name: 'Weighted side plank (5B)',
    day: 'fri',
    block: 'main',
    order: 6,
    metric: 'hold',
    tracked: true,
    supersetId: 'fri-5',
    coreFunction: 'anti-lateral flexion',
    cues: ['20–30 s per side', 'once 30 s is clearly below target RPE, add a small plate or lengthen the lever'],
    progressionLadder: ['30 s clean per side', 'small plate', 'harder lever'],
    stopRules: ['hips dropped', 'torso rotated'],
    prescriptions: weekly(
      [
        [2, 8, 8],
        [2, 8, 8],
        [2, 8, 8],
        [3, 8.5, 8.5],
        [3, 8.5, 8.5],
        [1, 6, 6],
        [2, 8, 8],
        [2, 8, 8],
        [3, 8.5, 8.5],
        [3, 8.5, 8.5],
        [2, 8.5, 8.5],
        [2, 7, 7, '1–2 sets'],
      ],
      { secLow: 20, secHigh: 30, perSide: true },
    ),
  },

  // ==========================================================================
  // FRIDAY LATER — HIIT
  //
  // 30 s hard / 90 s very easy. Hard is RPE 9–9.5, not sloppy failure. Air
  // bike, stationary bike, rower or ski erg to limit eccentric damage. After
  // Push B or several hours later, never before weighted dips/HSPU. Progress
  // the number of QUALITY intervals first; once eight are established, improve
  // average output slightly while retaining all eight. If output crashes after
  // the first few intervals, the opening effort was too hard.
  // ==========================================================================
  {
    id: 'fri-hiit-warmup',
    name: 'Warm-up — easy + accelerations',
    day: 'fri',
    block: 'later',
    order: 1,
    metric: 'runInterval',
    tracked: true,
    rpeScale: 'run',
    cues: ['6–8 min easy', 'then 3 × 10 s progressive accelerations with 50–60 s easy between'],
    progressionLadder: [],
    stopRules: [],
    prescriptions: [{ weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], sets: 1, minutesEach: 8, rpeLow: 2, rpeHigh: 3, note: '6–8 min' }],
  },
  {
    id: 'fri-hiit-intervals',
    name: 'HIIT intervals — 30 s hard',
    day: 'fri',
    block: 'later',
    order: 2,
    metric: 'hold',
    tracked: true,
    rpeScale: 'run',
    restSeconds: 90,
    cues: ['30 s hard', '90 s very easy between', 'hard is RPE 9–9.5, not sloppy absolute failure'],
    progressionLadder: ['more quality intervals, up to eight', 'slightly more output while keeping all eight'],
    stopRules: ['output crashed after the first few — the opener was too hard'],
    prescriptions: weekly(
      [
        [5, 9, 9],
        [6, 9, 9],
        [6, 9, 9.5],
        [7, 9, 9],
        [8, 9, 9.5],
        [4, 8, 8],
        [6, 9, 9],
        [7, 9, 9],
        [8, 9, 9.5],
        [8, 9.5, 9.5],
        [8, 9.5, 9.5],
        [5, 8.5, 9],
      ],
      { secLow: 30, secHigh: 30 },
    ),
  },
  {
    id: 'fri-hiit-cooldown',
    name: 'Cooldown',
    day: 'fri',
    block: 'later',
    order: 3,
    metric: 'runInterval',
    tracked: true,
    rpeScale: 'run',
    cues: ['5 min very easy'],
    progressionLadder: [],
    stopRules: [],
    prescriptions: [{ weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], sets: 1, minutesEach: 5, rpeLow: 2, rpeHigh: 2 }],
  },

  // ==========================================================================
  // SATURDAY — PULL B: HEAVY PULL + SECONDARY FRONT-LEVER WORK
  // ==========================================================================
  {
    id: 'fl-hold-banded',
    name: 'Band-assisted full-shape front-lever hold',
    day: 'sat',
    block: 'main',
    order: 1,
    metric: 'hold',
    ladderId: 'frontLever',
    tracked: true,
    restSeconds: 210,
    cues: ['8–10 s hold', 'rest 3–4 min', 'intentionally easier than Tuesday\'s hard lever work'],
    // "Reduce band assistance only when: body stays horizontal; elbows stay
    // locked; hips do not sag."
    progressionLadder: ['body horizontal, elbows locked, hips up', 'then reduce band assistance'],
    stopRules: FL_STOP,
    prescriptions: weekly(
      [
        [3, 6, 7],
        [3, 6, 7],
        [3, 7, 7],
        [4, 7, 7],
        [4, 7, 7],
        [2, 5, 6],
        [3, 6, 7],
        [3, 7, 7],
        [4, 7, 7],
        [4, 7, 7],
        [3, 7, 7],
        [2, 6, 6],
      ],
      { secLow: 8, secHigh: 10 },
    ),
  },
  {
    id: 'ring-pullup',
    name: 'Weighted pull-up',
    day: 'sat',
    block: 'main',
    order: 2,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 270,
    cues: ['3–5 reps', 'rest 4–5 min', 'controlled dead hang, no kick, consistent top standard'],
    // "When all sets reach 5 clean reps at or below target RPE, add ~1.25–2.5 kg."
    progressionLadder: ['5 clean reps on every set', 'add 1.25–2.5 kg'],
    stopRules: ['kicked', 'top standard dropped', 'dead hang skipped'],
    prescriptions: weekly(
      [
        [4, 8, 8],
        [4, 8, 8],
        [4, 8, 8],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [2, 6, 7],
        [4, 8, 8],
        [4, 8, 8],
        [5, 8.5, 8.5],
        [5, 8.5, 8.5],
        [4, 8.5, 9],
        [3, 7, 8, '2–3 sets'],
      ],
      { repsLow: 3, repsHigh: 5 },
    ),
  },
  {
    id: 'fl-row-banded',
    name: 'Front-lever pull / row',
    day: 'sat',
    block: 'main',
    order: 3,
    metric: 'reps',
    ladderId: 'frontLeverRow',
    tracked: true,
    restSeconds: 270,
    cues: ['4–6 reps', 'rest 4–5 min', 'band-assisted full-shape version if required', 'body shape comes before band reduction'],
    progressionLadder: ['improve body line and hip height', 'reach 6 reps', 'reduce assistance', 'progress leverage'],
    stopRules: ['hips dropped', 'line broke to finish the rep'],
    prescriptions: weekly(
      [
        [3, 7.5, 8],
        [3, 8, 8],
        [3, 8, 8],
        [4, 8.5, 8.5],
        [4, 8.5, 8.5],
        [2, 6, 6],
        [3, 8, 8],
        [3, 8, 8],
        [4, 8.5, 8.5],
        [4, 8.5, 8.5],
        [3, 8.5, 8.5],
        [2, 7, 7],
      ],
      { repsLow: 4, repsHigh: 6 },
    ),
  },
  {
    id: 'hammer-curl',
    name: 'Hammer curl',
    day: 'sat',
    block: 'main',
    order: 4,
    metric: 'weightedReps',
    tracked: true,
    restSeconds: 150,
    cues: ['8–12 reps', 'rest 2–3 min'],
    progressionLadder: ['12 strict reps', 'increase load'],
    stopRules: ['torso swung', 'elbows drifted'],
    prescriptions: weekly(ACCESSORY, { repsLow: 8, repsHigh: 12 }),
  },
  {
    id: 'windshield-wiper',
    name: 'Hanging windshield wiper',
    day: 'sat',
    block: 'main',
    order: 5,
    metric: 'reps',
    ladderId: 'windshieldWiper',
    tracked: true,
    restSeconds: 210,
    coreFunction: 'rotation / anti-rotation',
    cues: ['6–10 reps per side', 'rest 3–4 min', 'no swinging'],
    progressionLadder: ['bent knees', 'partially extended legs', 'straight legs / smaller ROM', 'straight legs / full ROM', 'slower eccentric', 'paused reps'],
    stopRules: ['swung', 'ROM shortened'],
    prescriptions: weekly(LOWER, { repsLow: 6, repsHigh: 10, perSide: true }),
  },

  // ==========================================================================
  // SUNDAY — LONG LOW-INTENSITY CARDIO
  //
  // RPE 2–3: full sentences, controlled breathing, finish feeling you could
  // continue. Incline walk, easy run, bike, hike, elliptical or walk/jog.
  // Progress DURATION, not intensity. If impact fatigue develops when running,
  // switch to bike, incline walking, hiking or elliptical.
  // ==========================================================================
  {
    id: 'sun-long-cardio',
    name: 'Long low-intensity cardio',
    day: 'sun',
    block: 'main',
    order: 1,
    metric: 'runInterval',
    tracked: true,
    rpeScale: 'run',
    cues: [
      'you should be able to speak in full sentences throughout',
      'brisk incline walk, easy run, bike, hike, elliptical or mixed walk/jog',
      'if impact fatigue develops, switch to bike, incline walking, hiking or elliptical',
    ],
    progressionLadder: ['longer duration at the same conversational effort'],
    stopRules: ['effort drifted above RPE 3 — this is not a race'],
    prescriptions: [
      { weeks: [1], sets: 1, minutesEach: 45, rpeLow: 2, rpeHigh: 3 },
      { weeks: [2], sets: 1, minutesEach: 50, rpeLow: 2, rpeHigh: 3 },
      { weeks: [3], sets: 1, minutesEach: 55, rpeLow: 2, rpeHigh: 3 },
      { weeks: [4], sets: 1, minutesEach: 60, rpeLow: 2, rpeHigh: 3 },
      { weeks: [5], sets: 1, minutesEach: 65, rpeLow: 2, rpeHigh: 3 },
      { weeks: [6], sets: 1, minutesEach: 45, rpeLow: 2, rpeHigh: 2, note: '40–45 min' },
      { weeks: [7], sets: 1, minutesEach: 60, rpeLow: 2, rpeHigh: 3 },
      { weeks: [8], sets: 1, minutesEach: 65, rpeLow: 2, rpeHigh: 3 },
      { weeks: [9], sets: 1, minutesEach: 70, rpeLow: 2, rpeHigh: 3 },
      { weeks: [10], sets: 1, minutesEach: 75, rpeLow: 2, rpeHigh: 3 },
      { weeks: [11], sets: 1, minutesEach: 90, rpeLow: 2, rpeHigh: 3, note: '80–90 min' },
      { weeks: [12], sets: 1, minutesEach: 60, rpeLow: 2, rpeHigh: 2 },
    ],
  },

  // ==========================================================================
  // SUNDAY LATER — FLEXIBILITY B: FRONT SPLIT + PIKE + BRIDGE + ANKLE
  //
  // Ideally eat, hydrate, and separate deeper flexibility work from the cardio
  // by a few hours.
  // ==========================================================================
  ...[
    {
      id: 'flexb-hip-flexor-split',
      name: 'Hip-flexor split position',
      order: 1,
      metric: 'hold' as const,
      ladderId: 'frontSplit',
      secLow: 45,
      perSide: true,
      cues: ['squeeze the rear glute', 'posterior pelvic tilt', 'avoid lumbar compensation'],
      overload: 'longer split stance while the pelvis stays controlled',
    },
    {
      id: 'flexb-half-split',
      name: 'Half-split hamstring stretch',
      order: 2,
      metric: 'hold' as const,
      ladderId: 'frontSplit',
      secLow: 45,
      secHigh: 60,
      perSide: true,
      cues: ['straight front knee', 'square hips'],
      overload: 'more hip flexion without bending the knee',
    },
    {
      id: 'flexb-front-split',
      name: 'Supported front split',
      order: 3,
      metric: 'hold' as const,
      ladderId: 'frontSplit',
      secLow: 30,
      secHigh: 45,
      perSide: true,
      cues: ['use blocks or parallettes'],
      overload: 'lower support, reduce the pelvis-to-floor gap',
    },
    {
      id: 'flexb-pike',
      name: 'Pike stretch',
      order: 4,
      metric: 'hold' as const,
      ladderId: 'pike',
      secLow: 45,
      secHigh: 60,
      cues: ['straight knees', 'fold from the hips', 'chest and abdomen toward the thighs'],
      overload: 'hands farther beyond the feet while the knees stay straight',
    },
    {
      id: 'flexb-bridge',
      name: 'Bridge progression',
      order: 5,
      metric: 'hold' as const,
      ladderId: 'bridge',
      secLow: 20,
      secHigh: 30,
      cues: ['straighter elbows', 'more shoulder opening', 'do not rely only on lumbar extension'],
      overload: 'straighter elbows and greater shoulder opening before narrowing the stance',
    },
    {
      id: 'flexb-ankle-dorsiflexion',
      name: 'Ankle dorsiflexion stretch',
      order: 6,
      metric: 'hold' as const,
      secLow: 30,
      secHigh: 45,
      perSide: true,
      cues: ['heel stays fully planted'],
      overload: 'increase knee-over-toe distance while the heel stays down',
    },
  ].map(flexibilityExercise('sun', FLEX_B_WEEKS)),
];
