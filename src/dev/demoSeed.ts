// Dev-only demo data generator — SPEC.md prompt pack 11.2 Prompt 8.
// Produces 6 weeks of plausible logs, body weights and calories so every
// chart (Progress, Body, Review) has something to show. Deterministic (seeded
// PRNG) so repeated loads are reproducible, which makes it useful for
// screenshotting and for the vitest sanity check in __tests__/demoSeed.test.ts.
import { addDays, format, parseISO, startOfWeek, subDays } from 'date-fns';
import { program } from '../data/program';
import { ladders } from '../data/ladders';
import { benchmarks } from '../data/mobility';
import { resolvePrescription } from '../domain/phase';
import { newId } from '../domain/id';
import type { PersistedState } from '../store/persist';
import { defaultSettings } from '../store/persist';
import type {
  BenchmarkEntry,
  DayId,
  Exercise,
  ProgressionEvent,
  Readiness,
  SessionLog,
  SetLog,
  TechniqueFlag,
} from '../domain/types';

const DEMO_WEEKS = 6;
const DAY_ORDER: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Deliberately kept flat across weeks 4-6 so the stagnation detector fires on
// it — it's a SKILLS exercise (HSPU/handstand), so it also shows up as a flat
// line on the Progress screen's skill headline and difficulty timeline.
const STAGNANT_EXERCISE_ID = 'hs-balance-primary';

// Tiny deterministic PRNG (mulberry32) — reproducible "plausible" noise.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(12345);
const jitter = (spread: number) => (rand() * 2 - 1) * spread;

/**
 * Fully flat across all 6 weeks for the stagnant exercise (bestQualifyingScore
 * of the last 3 sessions never exceeds the prior sessions' best by isFlat's
 * 3% threshold, however the review week is sliced) — steady ~4%/week growth
 * for everything else.
 */
function weekFactor(week: number, exerciseId: string): number {
  if (exerciseId === STAGNANT_EXERCISE_ID) return 1.0;
  return 1 + (week - 1) * 0.04;
}

interface DemoBase {
  reps?: number;
  seconds?: number;
  addedKg?: number;
  distanceM?: number;
  intensityPct?: number;
}

function baseValueFor(exercise: Exercise): DemoBase {
  switch (exercise.metric) {
    case 'reps':
      return { reps: 8 };
    case 'weightedReps':
      return { reps: 6, addedKg: 5 };
    case 'hold':
      return { seconds: 12 };
    case 'attempts':
      return { seconds: 6 };
    case 'sprint':
      return { distanceM: 30, intensityPct: 88 };
    case 'distanceTime':
      return { reps: 35 };
    case 'timeOnly':
      return {};
  }
}

// Mild step progression through a ladder's variants for the demo's 4 SKILLS
// exercises, so the difficulty timeline chart shows movement. The stagnant
// exercise stays pinned to one variant throughout, reinforcing the plateau.
function variantIdForWeek(exercise: Exercise, week: number): string | undefined {
  if (!exercise.ladderId) return undefined;
  const ladder = ladders.find((l) => l.id === exercise.ladderId);
  if (!ladder) return undefined;
  if (exercise.id === STAGNANT_EXERCISE_ID) return ladder.variants[1]?.id;
  const step = Math.min(ladder.variants.length - 1, Math.floor((week - 1) / 2));
  return ladder.variants[step]?.id;
}

const FLAG_ROTATION: TechniqueFlag[] = ['partialROM', 'usedMomentum', 'lineChanged'];

function round(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function healthyReadiness(week: number, dayIndex: number): Readiness {
  // Weeks 4-6 stay clean on shoulder irritation so the stagnant HSPU exercise
  // reads as "healthy" (not "recovery") when the stagnation card fires.
  const shoulderIrritation = week <= 3 && dayIndex % 5 === 0 ? 1 : 0;
  const soreness = dayIndex % 4 === 0 ? 1 : 0;
  return {
    sleepHours: round(7.5 + jitter(0.5), 0.5),
    soreness: soreness as 0 | 1,
    elbowIrritation: (dayIndex % 6 === 0 ? 1 : 0) as 0 | 1,
    shoulderIrritation: shoulderIrritation as 0 | 1,
    motivation: (2 + (dayIndex % 3 === 0 ? 1 : 0)) as 2 | 3,
  };
}

function buildSet(exercise: Exercise, week: number, setIndex: number, flagThisSet: boolean): SetLog {
  const base = baseValueFor(exercise);
  const factor = weekFactor(week, exercise.id);
  // Deliberately uniform across sets within a session (not tapered by
  // setIndex): bestQualifyingScore takes the max set in a session, so any
  // per-set growth would inflate later-indexed sets and defeat the
  // controlled flat/rising trajectories weekFactor is designed to produce.
  const reps = base.reps !== undefined ? Math.max(1, Math.round(base.reps * factor)) : undefined;
  const seconds = base.seconds !== undefined ? Math.max(1, Math.round(base.seconds * factor)) : undefined;
  const addedKg = base.addedKg !== undefined ? round(base.addedKg * factor, 0.5) : undefined;
  const distanceM = base.distanceM !== undefined ? Math.round(base.distanceM) : undefined;
  const intensityPct =
    base.intensityPct !== undefined ? Math.min(98, Math.round(base.intensityPct + (factor - 1) * 30)) : undefined;

  const techniqueFlags: TechniqueFlag[] = flagThisSet ? [FLAG_ROTATION[(week + setIndex) % FLAG_ROTATION.length]] : [];

  const set: SetLog = {
    id: newId(),
    techniqueFlags,
    score: 0,
    variantId: variantIdForWeek(exercise, week),
    assistanceTier: 0,
  };
  if (exercise.metric === 'attempts') {
    const attempts = [seconds ?? 6, (seconds ?? 6) + 1];
    set.attempts = attempts;
    set.seconds = Math.max(...attempts);
  } else {
    if (reps !== undefined) set.reps = reps;
    if (seconds !== undefined) set.seconds = seconds;
  }
  if (addedKg !== undefined) set.addedKg = addedKg;
  if (distanceM !== undefined) set.distanceM = distanceM;
  if (intensityPct !== undefined) set.intensityPct = intensityPct;
  if (exercise.metric === 'reps' || exercise.metric === 'weightedReps') {
    set.rpe = Math.min(9, round(6.5 + (week - 1) * 0.35, 0.5));
  }
  return set;
}

function amCompletionSet(): SetLog {
  return { id: newId(), techniqueFlags: [], score: 0 };
}

export function generateDemoState(): PersistedState {
  const today = new Date();
  const recentMonday = startOfWeek(today, { weekStartsOn: 1 });
  const blockStartDate = format(subDays(recentMonday, (DEMO_WEEKS - 1) * 7), 'yyyy-MM-dd');
  const blockStart = parseISO(blockStartDate);

  const sessionLogs: Record<string, SessionLog> = {};
  const dailyEntries: PersistedState['dailyEntries'] = {};

  for (let week = 1; week <= DEMO_WEEKS; week++) {
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayId = DAY_ORDER[dayIdx];
      const date = format(addDays(blockStart, (week - 1) * 7 + dayIdx), 'yyyy-MM-dd');
      const globalDayIndex = (week - 1) * 7 + dayIdx;

      // --- body weight & nutrition (every day) ---
      const weightKg = round(78 - (globalDayIndex / 7) * 0.35 + jitter(0.25), 0.1);
      const proteinG = Math.round(180 + jitter(15));
      const calories = Math.round(2300 - globalDayIndex * 2 + jitter(120));
      // Remaining calories after protein split 60/40 carbs/fat -- roughly plausible
      // cut macros, not exact (no caloriesOverridden flag is set, so the app never
      // shows a mismatch hint against these).
      const remaining = Math.max(0, calories - proteinG * 4);
      const carbsG = Math.round((remaining * 0.6) / 4);
      const fatG = Math.round((remaining * 0.4) / 9);
      dailyEntries[date] = { date, weightKg, proteinG, carbsG, fatG, calories };

      const dayExercises = program.filter((e) => e.day === dayId);
      const amExercises = dayExercises.filter((e) => e.block === 'am');
      const mainExercises = dayExercises.filter((e) => e.block === 'main');

      // --- AM block: mark every AM item complete (feeds the consistency heatmap) ---
      if (amExercises.length > 0) {
        sessionLogs[`${date}:am`] = {
          id: `${date}:am`,
          date,
          week,
          phase: 'calibration',
          day: dayId,
          block: 'am',
          startedAt: `${date}T07:00:00.000Z`,
          completedAt: `${date}T07:20:00.000Z`,
          exercises: amExercises.map((e) => ({ exerciseId: e.id, sets: [amCompletionSet()] })),
        };
      }

      // --- main block: realistic scored sets per resolved prescription ---
      if (mainExercises.length > 0) {
        const readiness = healthyReadiness(week, globalDayIndex);
        const exerciseLogs = mainExercises
          .map((exercise) => {
            const prescription = resolvePrescription(exercise, week);
            if (!prescription) return null;
            const setCount = Math.min(6, Math.max(1, prescription.sets));
            const sets = Array.from({ length: setCount }, (_, i) => {
              const flagThisSet = exercise.id !== STAGNANT_EXERCISE_ID && (globalDayIndex + i) % 13 === 0;
              return buildSet(exercise, week, i, flagThisSet);
            });
            return { exerciseId: exercise.id, sets };
          })
          .filter((log): log is { exerciseId: string; sets: SetLog[] } => log !== null);

        if (exerciseLogs.length > 0) {
          sessionLogs[`${date}:main`] = {
            id: `${date}:main`,
            date,
            week,
            phase: week === 6 ? 'deload' : week <= 2 ? 'calibration' : 'accumulation',
            day: dayId,
            block: 'main',
            startedAt: `${date}T17:00:00.000Z`,
            completedAt: `${date}T18:00:00.000Z`,
            readiness,
            sessionRpe: Math.min(9, round(6.5 + (week - 1) * 0.3, 0.5)),
            exercises: exerciseLogs,
          };
        }
      }
    }
  }

  const progressionEvents: ProgressionEvent[] = [
    {
      id: newId(),
      date: format(addDays(blockStart, 3), 'yyyy-MM-dd'),
      exerciseId: 'fl-hard-iso',
      axis: 'cleaner line',
      from: 'tuck',
      to: 'tuck (cleaner)',
      note: 'Demo data.',
    },
    {
      id: newId(),
      date: format(addDays(blockStart, 21), 'yyyy-MM-dd'),
      exerciseId: 'pike-hspu',
      axis: 'higher feet',
      from: 'low box',
      to: 'high box',
      note: 'Demo data.',
    },
  ];

  const benchmarkEntries: BenchmarkEntry[] = [
    {
      date: format(blockStart, 'yyyy-MM-dd'),
      week: 1,
      values: Object.fromEntries(benchmarks.map((b) => [b.id, b.direction === 'lower-better' ? 30 : 10])),
    },
    {
      date: format(addDays(blockStart, 5 * 7), 'yyyy-MM-dd'),
      week: 6,
      values: Object.fromEntries(
        benchmarks.map((b) => [b.id, b.direction === 'lower-better' ? 25 : 13]),
      ),
    },
  ];

  return {
    schemaVersion: 1,
    settings: { ...defaultSettings(), blockStartDate },
    dailyEntries,
    sessionLogs,
    benchmarkEntries,
    progressionEvents,
  };
}
