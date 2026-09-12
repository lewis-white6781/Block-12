import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import {
  BLOCK_DAYS,
  blockDayIndex,
  clampBlockDay,
  currentWeek,
  dateForBlockDay,
  dayIdForDate,
  exercisesFor,
  isBlockComplete,
  isWithinBlock,
  phaseForWeek,
  resolvePrescription,
  weekRpeCap,
} from '../phase';
import type { Exercise, Phase } from '../types';

describe('dayIdForDate', () => {
  it('maps calendar dates to the right DayId', () => {
    // 2026-07-30 is a Thursday.
    expect(dayIdForDate(new Date(2026, 6, 30))).toBe('thu');
    expect(dayIdForDate(new Date(2026, 6, 27))).toBe('mon');
    expect(dayIdForDate(new Date(2026, 7, 2))).toBe('sun');
  });
});

// SPEC-V5.0.md section 3 — one arc with a single deload at week 6.
describe('phaseForWeek', () => {
  const expected: Record<number, Phase> = {
    1: 'reentry',
    2: 'reentry',
    3: 'accumulation',
    4: 'accumulation',
    5: 'accumulation',
    6: 'deload',
    7: 'intensification',
    8: 'intensification',
    9: 'intensification',
    10: 'intensification',
    11: 'realization',
    12: 'consolidation',
  };

  it('resolves all 12 weeks to the phase in the week→phase map', () => {
    for (let week = 1; week <= 12; week++) {
      expect(phaseForWeek(week)).toBe(expected[week]);
    }
  });

  it('deloads exactly once, at week 6', () => {
    const deloads = Array.from({ length: 12 }, (_, i) => i + 1).filter((w) => phaseForWeek(w) === 'deload');
    expect(deloads).toEqual([6]);
  });

  it('clamps rather than returning undefined outside 1..12', () => {
    expect(phaseForWeek(0)).toBe('reentry');
    expect(phaseForWeek(99)).toBe('consolidation');
  });
});

describe('weekRpeCap', () => {
  // Read off SPEC-V5.0.md's own weekly tables — the highest STRENGTH-scale RPE
  // the plan prescribes that week, not an invented ceiling. Week 5 and weeks
  // 10–11 reach 9 on the accessories; the week-6 deload tops out at 7.
  it('matches the plan\'s maximum prescribed RPE per week', () => {
    const expected = [8, 8, 8.5, 8.5, 9, 7, 8, 8.5, 8.5, 9, 9, 8];
    for (let week = 1; week <= 12; week++) {
      expect(weekRpeCap(week)).toBe(expected[week - 1]);
    }
  });

  it('drops to 7 in the week-6 deload and nowhere else', () => {
    expect(weekRpeCap(6)).toBe(7);
    for (const week of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]) expect(weekRpeCap(week)).toBeGreaterThan(7);
  });
});

// Prescription resolution over the live program, the day/block map and the
// per-week set counts are asserted in data/__tests__/program.test.ts, next to
// the content they describe. What is left here is phase.ts's own behaviour.

// SPEC-V4.0.md section 4: `sets: 0` is how a week opts an exercise out. It has
// to be authored explicitly, because resolvePrescription's nearest-earlier
// fallback would otherwise fill the gap with a neighbouring week's numbers.
describe('exercisesFor and the sets: 0 opt-out', () => {
  function ex(prescriptions: Exercise['prescriptions']): Exercise {
    return {
      id: 'recovery-run',
      name: 'Recovery run',
      day: 'wed',
      block: 'later',
      order: 1,
      metric: 'runInterval',
      tracked: true,
      cues: [],
      progressionLadder: [],
      stopRules: [],
      prescriptions,
    };
  }

  const recoveryRun = ex([
    { weeks: [1, 2], sets: 0 },
    { weeks: [3], sets: 2, minutesEach: 10 },
    { weeks: [4], sets: 0 },
    { weeks: [5], sets: 2, minutesEach: 10 },
  ]);

  it('drops an exercise in the weeks it is prescribed zero sets', () => {
    expect(exercisesFor([recoveryRun], 'wed', 'later', 1)).toEqual([]);
    expect(exercisesFor([recoveryRun], 'wed', 'later', 2)).toEqual([]);
    expect(exercisesFor([recoveryRun], 'wed', 'later', 4)).toEqual([]);
  });

  it('includes it in the weeks it has volume', () => {
    expect(exercisesFor([recoveryRun], 'wed', 'later', 3)).toHaveLength(1);
    expect(exercisesFor([recoveryRun], 'wed', 'later', 5)).toHaveLength(1);
  });

  it('stops the nearest-earlier fallback leaking week 3 into week 4', () => {
    // Without the explicit `weeks: [4], sets: 0` entry, week 4 would resolve
    // back to week 3's two blocks.
    expect(resolvePrescription(recoveryRun, 4)?.sets).toBe(0);
  });
});

// --- Block-day addressing (SPEC-V3.0.md section 4) ---
describe('block-day addressing', () => {
  const start = '2026-01-05'; // a Monday

  it('indexes the first day of the block as 0 and the last as 83', () => {
    expect(blockDayIndex(parseISO('2026-01-05'), start)).toBe(0);
    expect(blockDayIndex(parseISO('2026-03-29'), start)).toBe(BLOCK_DAYS - 1);
  });

  it('round-trips every day of the block', () => {
    for (let i = 0; i < BLOCK_DAYS; i++) {
      expect(blockDayIndex(dateForBlockDay(start, i), start)).toBe(i);
    }
  });

  it('reports out-of-block dates rather than silently clamping', () => {
    expect(blockDayIndex(parseISO('2026-01-04'), start)).toBe(-1);
    expect(blockDayIndex(parseISO('2026-03-30'), start)).toBe(BLOCK_DAYS);
    expect(isWithinBlock(-1)).toBe(false);
    expect(isWithinBlock(BLOCK_DAYS)).toBe(false);
    expect(isWithinBlock(0)).toBe(true);
    expect(isWithinBlock(BLOCK_DAYS - 1)).toBe(true);
  });

  it('clamps into 0..83', () => {
    expect(clampBlockDay(-5)).toBe(0);
    expect(clampBlockDay(0)).toBe(0);
    expect(clampBlockDay(40)).toBe(40);
    expect(clampBlockDay(BLOCK_DAYS)).toBe(BLOCK_DAYS - 1);
    expect(clampBlockDay(9999)).toBe(BLOCK_DAYS - 1);
  });

  it('covers exactly the 12 weeks currentWeek reports, with no gap at either end', () => {
    expect(currentWeek(dateForBlockDay(start, 0), start)).toBe(1);
    expect(currentWeek(dateForBlockDay(start, 6), start)).toBe(1);
    expect(currentWeek(dateForBlockDay(start, 7), start)).toBe(2);
    expect(currentWeek(dateForBlockDay(start, BLOCK_DAYS - 1), start)).toBe(12);
    expect(isBlockComplete(dateForBlockDay(start, BLOCK_DAYS - 1), start)).toBe(false);
    expect(isBlockComplete(dateForBlockDay(start, BLOCK_DAYS), start)).toBe(true);
  });
});
