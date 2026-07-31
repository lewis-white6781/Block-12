import { describe, expect, it } from 'vitest';
import { dayIdForDate, phaseForWeek, resolvePrescription } from '../phase';
import { program } from '../../data/program';
import type { DayId, Phase } from '../types';

describe('dayIdForDate', () => {
  it('maps calendar dates to the right DayId', () => {
    // 2026-07-30 is a Thursday.
    expect(dayIdForDate(new Date(2026, 6, 30))).toBe('thu');
    expect(dayIdForDate(new Date(2026, 6, 27))).toBe('mon');
    expect(dayIdForDate(new Date(2026, 7, 2))).toBe('sun');
  });
});

describe('phaseForWeek', () => {
  const expected: Record<number, Phase> = {
    1: 'calibration',
    2: 'calibration',
    3: 'accumulation',
    4: 'accumulation',
    5: 'accumulation',
    6: 'deload',
    7: 'intensification',
    8: 'intensification',
    9: 'intensification',
    10: 'peak',
    11: 'taper',
    12: 'test',
  };

  it('resolves all 12 weeks to the phase in the week→phase map', () => {
    for (let week = 1; week <= 12; week++) {
      expect(phaseForWeek(week)).toBe(expected[week]);
    }
  });
});

describe('resolvePrescription over the seeded program', () => {
  const trackedExercises = program.filter((e) => e.tracked);

  // optional-run is explicitly gated "from week 3 only" (SPEC.md section 5.7) —
  // weeks 1–2 legitimately have no prescription, by design, not by transcription gap.
  const knownGaps = new Set(['optional-run:1', 'optional-run:2']);

  it('resolves a non-null prescription for every tracked exercise, every week (documented gaps excepted)', () => {
    const failures: string[] = [];

    for (const exercise of trackedExercises) {
      for (let week = 1; week <= 12; week++) {
        const prescription = resolvePrescription(exercise, week);
        if (!prescription && !knownGaps.has(`${exercise.id}:${week}`)) {
          failures.push(`${exercise.id} (week ${week})`);
        }
      }
    }

    if (failures.length > 0) {
      console.log('Exercises that failed to resolve a prescription:', failures);
    }
    expect(failures).toEqual([]);
  });
});

describe('program totals', () => {
  const trackedExercises = program.filter((e) => e.tracked);
  const mainByDay = new Map<DayId, number>();
  const amByDay = new Map<DayId, number>();

  for (const exercise of program) {
    const map = exercise.block === 'main' ? mainByDay : amByDay;
    map.set(exercise.day, (map.get(exercise.day) ?? 0) + 1);
  }

  it('has an AM session on all 7 days', () => {
    expect(amByDay.size).toBe(7);
  });

  it('has a full multi-exercise main session on exactly 5 days (Mon, Tue, Wed, Fri, Sat)', () => {
    const fullMainDays = [...mainByDay.entries()]
      .filter(([, count]) => count > 1)
      .map(([day]) => day)
      .sort();
    expect(fullMainDays).toEqual(['fri', 'mon', 'sat', 'tue', 'wed']);
  });

  it('prints and asserts the total tracked-exercise count for hand verification (SPEC.md section 11.3)', () => {
    const ids = trackedExercises.map((e) => e.id).sort();
    console.log(`Tracked exercises (${ids.length}):`, ids);
    // v1.0 baseline: SPEC.md's own prompt pack (section 11.2, Prompt 2) states
    // 30; careful transcription of section 5 as written yields 29 (main-only
    // tracked exercises, since AM was tracked: false except two attempts
    // exercises) -- that 29-vs-30 discrepancy is recorded in SPEC-V1.1.md
    // section 1's amendment table and stands unresolved as a v1.0 spec note.
    //
    // v1.1: every AM exercise is now tracked: true (SPEC-V1.1.md section 2),
    // so the count is all 68 program entries (41 AM + 27 main), not just the
    // 29 previously-tracked main + 2 AM exceptions.
    expect(ids.length).toBe(68);
  });
});
