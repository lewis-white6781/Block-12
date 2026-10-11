import { describe, expect, it } from 'vitest';
import { dailyChecksFor, dayTitles, program, sessionTitles } from '../program';
import { SKILLS, relevantJoint } from '../../domain/analysis';
import { ladders } from '../../domain/../data/ladders';
import { exercisesFor, resolvePrescription } from '../../domain/phase';
import { jointVolumeWarning } from '../../domain/readiness';
import type { Block, DayId, Readiness } from '../../domain/types';

const DAYS: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const BLOCKS: Block[] = ['am', 'main', 'later'];
const WEEKS = Array.from({ length: 12 }, (_, i) => i + 1);

function idsFor(day: DayId, block: Block, week: number): string[] {
  return exercisesFor(program, day, block, week).map((e) => e.id);
}

function byId(id: string) {
  const exercise = program.find((e) => e.id === id);
  if (!exercise) throw new Error(`no exercise ${id}`);
  return exercise;
}

/** [sets, rpeLow, rpeHigh] for every week, so a whole table can be asserted at once. */
function table(id: string): [number, number | undefined, number | undefined][] {
  return WEEKS.map((week) => {
    const p = resolvePrescription(byId(id), week)!;
    return [p.sets, p.rpeLow, p.rpeHigh];
  });
}

// The "Sets by phase" table, as the ★ exercises read it. Weeks 11–12 are the
// Christmas floor: 3 sets, no RPE — for ★ exercises that are in the floor.
const STAR_TABLE: [number, number | undefined, number | undefined][] = [
  [3, 8, 8.5],
  [3, 8, 8.5],
  [4, 8.5, 8.5],
  [4, 8.5, 8.5],
  [2, 6, 7],
  [4, 8.5, 9],
  [4, 8.5, 9],
  [4, 8.5, 9],
  [5, 9.5, 10],
  [5, 9.5, 10],
  [3, undefined, undefined],
  [3, undefined, undefined],
];

// "All other exercises: 3 sets (2 in Week 5)", at the phase RPE.
const OTHER_TABLE_FLOOR: typeof STAR_TABLE = STAR_TABLE.map(([, lo, hi], i) => [i === 4 ? 2 : 3, lo, hi]);

// SPEC-V6.0.md section 2 — Upper A / Rest / Football / Upper B / Football /
// Mobility + Core / Lower.
describe('the weekly structure', () => {
  it('has a gym session on Monday, Thursday, Saturday and Sunday only', () => {
    for (const week of WEEKS) {
      const withMain = DAYS.filter((day) => idsFor(day, 'main', week).length > 0);
      expect(withMain, `week ${week}`).toEqual(['mon', 'thu', 'sat', 'sun']);
    }
  });

  it('uses no AM or later slots', () => {
    for (const week of WEEKS) {
      for (const day of DAYS) {
        expect(idsFor(day, 'am', week)).toEqual([]);
        expect(idsFor(day, 'later', week)).toEqual([]);
      }
    }
  });

  it('names every slot it prescribes, and nothing it does not', () => {
    for (const day of DAYS) {
      for (const block of BLOCKS) {
        const prescribed = WEEKS.some((week) => idsFor(day, block, week).length > 0);
        expect(sessionTitles[day][block] !== undefined, `${day}/${block}`).toBe(prescribed);
      }
      expect(dayTitles[day]).toBeTruthy();
    }
  });

  it('ticks handstand + mobility every day and football on Wednesday and Friday', () => {
    for (const day of DAYS) {
      expect(dailyChecksFor(day).map((c) => c.id)).toEqual(
        day === 'wed' || day === 'fri' ? ['handstand-mobility', 'football'] : ['handstand-mobility'],
      );
    }
  });
});

describe('Monday — Upper A', () => {
  it('runs the six rows in order, the superset sharing row 5', () => {
    expect(idsFor('mon', 'main', 1)).toEqual([
      'hspu-primary',
      'ring-dip',
      'ring-pullup',
      'fl-hold-banded',
      'lateral-raise',
      'overhead-triceps-ext',
      'dragon-flag',
    ]);
    expect(byId('lateral-raise').supersetId).toBe(byId('overhead-triceps-ext').supersetId);
    expect(byId('lateral-raise').order).toBe(5);
  });

  it('runs the three ★ lifts on the ★ table', () => {
    for (const id of ['hspu-primary', 'ring-dip', 'ring-pullup']) expect(table(id), id).toEqual(STAR_TABLE);
  });

  it('notes the 4–5 set range in the peak weeks', () => {
    expect(resolvePrescription(byId('ring-dip'), 9)?.note).toBe('4–5 sets');
  });

  it('holds the banded front lever at its stated RPE 7, 8–10 s', () => {
    const p = resolvePrescription(byId('fl-hold-banded'), 3)!;
    expect([p.secLow, p.secHigh, p.rpeLow, p.rpeHigh]).toEqual([8, 10, 7, 7]);
  });

  it('runs the floor (rows 1–3) at Christmas and nothing else', () => {
    expect(idsFor('mon', 'main', 11)).toEqual(['hspu-primary', 'ring-dip', 'ring-pullup']);
    expect(idsFor('mon', 'main', 12)).toEqual(['hspu-primary', 'ring-dip', 'ring-pullup']);
  });
});

describe('Thursday — Upper B', () => {
  it('runs the six rows in order', () => {
    expect(idsFor('thu', 'main', 1)).toEqual([
      'fl-hold-primary',
      'fl-raise',
      'hspu-secondary',
      'fl-row-banded',
      'ring-curl-b',
      'ring-reverse-fly',
      'standing-ab-wheel',
    ]);
  });

  it('stars the lever hold, the raise and the row, not the wall HSPU', () => {
    for (const id of ['fl-hold-primary', 'fl-raise']) expect(table(id), id).toEqual(STAR_TABLE);
    expect(table('fl-row-banded').slice(0, 10)).toEqual(STAR_TABLE.slice(0, 10));
    expect(table('hspu-secondary')).toEqual(OTHER_TABLE_FLOOR);
  });

  it('floors rows 1–3, which drops the ★ row at row 4', () => {
    expect(idsFor('thu', 'main', 11)).toEqual(['fl-hold-primary', 'fl-raise', 'hspu-secondary']);
  });
});

describe('Saturday — Mobility + Core', () => {
  it('runs all twelve rows', () => {
    expect(exercisesFor(program, 'sat', 'main', 1).map((e) => e.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('holds every stretch at RPE 6–7.5 on the stretch scale', () => {
    for (const id of [
      'flexa-cossack',
      'flexa-pancake-good-morning',
      'flexb-hip-flexor-split',
      'flexa-middle-split',
      'flexb-front-split',
      'flexa-bench-shoulder',
      'flexb-bridge',
    ]) {
      expect(byId(id).rpeScale, id).toBe('stretch');
      const p = resolvePrescription(byId(id), 3)!;
      expect([p.rpeLow, p.rpeHigh], id).toEqual([6, 7.5]);
    }
  });

  it('uses the table\'s own set counts, and 2 sets in week 5', () => {
    expect(resolvePrescription(byId('flexb-front-split'), 1)?.sets).toBe(2);
    expect(resolvePrescription(byId('pike-compression-lsit'), 1)?.sets).toBe(4);
    expect(resolvePrescription(byId('pike-compression-lsit'), 5)?.sets).toBe(2);
    expect(resolvePrescription(byId('cable-crunch'), 1)?.sets).toBe(3);
  });

  it('floors rows 1–4', () => {
    expect(idsFor('sat', 'main', 11)).toEqual([
      'flexa-cossack',
      'flexa-pancake-good-morning',
      'hanging-leg-raise-slow',
      'copenhagen-plank',
    ]);
  });
});

describe('Sunday — Lower', () => {
  it('opens with the 8-minute warm-up, then the five rows', () => {
    expect(idsFor('sun', 'main', 1)).toEqual([
      'sun-warmup',
      'broad-jump',
      'lateral-bound',
      'trap-bar-deadlift',
      'bulgarian-split-squat',
      'nordic-curl',
      'calf-raise-b',
      'tibialis-raise',
    ]);
    expect(resolvePrescription(byId('sun-warmup'), 1)?.minutesEach).toBe(8);
  });

  it('runs the jumps at 3–4 sets', () => {
    const p = resolvePrescription(byId('broad-jump'), 1)!;
    expect(p.sets).toBe(4);
    expect(p.note).toBe('3–4 sets');
  });

  it('stars the deadlift and the split squat', () => {
    expect(table('trap-bar-deadlift')).toEqual(STAR_TABLE);
    expect(table('bulgarian-split-squat').slice(0, 10)).toEqual(STAR_TABLE.slice(0, 10));
  });

  it('floors the warm-up, 1, 2 and 4', () => {
    expect(idsFor('sun', 'main', 12)).toEqual([
      'sun-warmup',
      'broad-jump',
      'lateral-bound',
      'trap-bar-deadlift',
      'nordic-curl',
    ]);
  });
});

describe('program integrity', () => {
  it('resolves a prescription for every exercise, every week', () => {
    const failures: string[] = [];
    for (const exercise of program) {
      for (const week of WEEKS) {
        if (resolvePrescription(exercise, week) === null) failures.push(`${exercise.id} (week ${week})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('authors every Christmas week explicitly, so nothing falls back to week 10', () => {
    for (const exercise of program) {
      for (const week of [11, 12]) {
        expect(exercise.prescriptions.some((p) => p.weeks.includes(week)), `${exercise.id} wk ${week}`).toBe(true);
      }
    }
  });

  it('gives every exercise a unique id, and shares a row number only within a superset', () => {
    const ids = program.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const day of DAYS) {
      for (const block of BLOCKS) {
        const slots = program
          .filter((e) => e.day === day && e.block === block)
          .map((e) => `${e.order}:${e.supersetId ?? e.id}`);
        expect(new Set(slots).size, `${day}/${block}`).toBe(
          new Set(program.filter((e) => e.day === day && e.block === block).map((e) => e.order)).size,
        );
      }
    }
  });

  it('points every ladderId at a ladder that exists', () => {
    const known = new Set(ladders.map((l) => l.id));
    for (const exercise of program) {
      if (exercise.ladderId) expect(known.has(exercise.ladderId), exercise.id).toBe(true);
    }
  });

  it('points every headline skill at something still prescribed', () => {
    for (const skill of SKILLS) {
      const exercise = program.find((e) => e.id === skill.exerciseId);
      expect(exercise, `${skill.id} -> ${skill.exerciseId}`).toBeDefined();
      expect(resolvePrescription(exercise!, 1)?.sets).toBeGreaterThan(0);
    }
  });
});

// The day -> joint mapping is derived from the program, so it is asserted here
// rather than in readiness.test.ts.
describe('joint warning days', () => {
  function sore(field: keyof Readiness): Readiness[] {
    const base: Readiness = {
      sleepHours: 8,
      soreness: 0,
      elbowIrritation: 0,
      shoulderIrritation: 0,
      achillesIrritation: 0,
      motivation: 3,
    };
    return [
      { ...base, [field]: 3 },
      { ...base, [field]: 3 },
    ];
  }

  it('warns about shoulders on the two upper days', () => {
    expect(jointVolumeWarning('shoulder', 'mon', sore('shoulderIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('shoulder', 'thu', sore('shoulderIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('shoulder', 'sun', sore('shoulderIrritation'))).toBeNull();
    expect(jointVolumeWarning('shoulder', 'tue', sore('shoulderIrritation'))).toBeNull();
  });

  it('warns about elbows on the two upper days', () => {
    expect(jointVolumeWarning('elbow', 'mon', sore('elbowIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('elbow', 'thu', sore('elbowIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('elbow', 'sun', sore('elbowIrritation'))).toBeNull();
  });

  it('warns about the Achilles on the jump-and-calf day', () => {
    expect(jointVolumeWarning('achilles', 'sun', sore('achillesIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('achilles', 'mon', sore('achillesIrritation'))).toBeNull();
  });

  it('names only exercises from the day it is warning about', () => {
    const warning = jointVolumeWarning('shoulder', 'mon', sore('shoulderIrritation'))!;
    expect(warning.suggestedExerciseIds.length).toBeGreaterThan(0);
    for (const id of warning.suggestedExerciseIds) {
      const exercise = program.find((e) => e.id === id)!;
      expect(exercise.day).toBe('mon');
      expect(relevantJoint(id)).toBe('shoulder');
    }
  });
});
