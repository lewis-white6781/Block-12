import { describe, expect, it } from 'vitest';
import { dayTitles, program, sessionTitles } from '../program';
import { SKILLS, relevantJoint } from '../../domain/analysis';
import { ladders } from '../../domain/../data/ladders';
import { exercisesFor, resolvePrescription } from '../../domain/phase';
import { jointVolumeWarning } from '../../domain/readiness';
import type { Block, DayId, Readiness } from '../../domain/types';

const DAYS: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const BLOCKS: Block[] = ['am', 'main', 'later'];

function idsFor(day: DayId, block: Block, week: number): string[] {
  return exercisesFor(program, day, block, week).map((e) => e.id);
}

// SPEC-V4.0.md section 2 — the weekly structure.
describe('the weekly structure', () => {
  it('runs grease-the-groove on Monday, Wednesday and Friday only', () => {
    const gtgDays = DAYS.filter((day) => idsFor(day, 'am', 1).length > 0);
    expect(gtgDays).toEqual(['mon', 'wed', 'fri']);
  });

  it('has a main session every single day', () => {
    for (const day of DAYS) {
      expect(idsFor(day, 'main', 1).length).toBeGreaterThan(0);
    }
  });

  it('has a later session on Tuesday and Sunday in week 1, and adds Wednesday from week 3', () => {
    expect(DAYS.filter((day) => idsFor(day, 'later', 1).length > 0)).toEqual(['tue', 'sun']);
    expect(DAYS.filter((day) => idsFor(day, 'later', 3).length > 0)).toEqual(['tue', 'wed', 'sun']);
  });

  it('names every slot it prescribes', () => {
    for (const day of DAYS) {
      for (const block of BLOCKS) {
        if (exercisesFor(program, day, block, 3).length === 0) continue;
        expect(sessionTitles[day][block], `${day}/${block}`).toBeTruthy();
      }
    }
    expect(Object.keys(dayTitles).sort()).toEqual([...DAYS].sort());
  });
});

// SPEC-V4.0.md — Monday's Full Body A, transcribed exactly.
describe('Monday — Full Body A', () => {
  it('runs the eight prescribed slots in order', () => {
    expect(idsFor('mon', 'main', 1)).toEqual([
      'hspu-primary',
      'ring-dip',
      'fl-hold-primary',
      'ffe-split-squat',
      'chest-supported-row',
      'dragon-flag',
      'lateral-raise',
      'incline-curl',
      'suitcase-carry',
    ]);
  });

  it('holds the primary HSPU at 5 reps every week and moves only sets and RPE', () => {
    const hspu = program.find((e) => e.id === 'hspu-primary')!;
    const expected = [
      { sets: 4, rpe: 8 },
      { sets: 4, rpe: 8 },
      { sets: 5, rpe: 8.5 },
      { sets: 3, rpe: 7 },
      { sets: 4, rpe: 8 },
      { sets: 5, rpe: 8.5 },
      { sets: 5, rpe: 8.5 },
      { sets: 3, rpe: 7 },
      { sets: 4, rpe: 8 },
      { sets: 4, rpe: 8.5 },
      { sets: 3, rpe: 8.5 },
      { sets: 2, rpe: 7.5 },
    ];
    expected.forEach((want, i) => {
      const p = resolvePrescription(hspu, i + 1)!;
      expect(p.sets, `week ${i + 1} sets`).toBe(want.sets);
      expect(p.rpeLow, `week ${i + 1} RPE`).toBe(want.rpe);
      expect(p.repsLow, `week ${i + 1} reps`).toBe(5);
      expect(p.repsHigh).toBe(5);
    });
  });

  it('holds the front lever at 6 seconds every week', () => {
    const fl = program.find((e) => e.id === 'fl-hold-primary')!;
    for (let week = 1; week <= 12; week++) {
      const p = resolvePrescription(fl, week)!;
      expect(p.secLow, `week ${week}`).toBe(6);
      expect(p.secHigh).toBe(6);
    }
    expect([1, 2, 3, 4].map((w) => resolvePrescription(fl, w)!.sets)).toEqual([3, 3, 4, 2]);
  });

  it('carries 30 m per side, progressed by load rather than distance', () => {
    const carry = program.find((e) => e.id === 'suitcase-carry')!;
    expect(carry.metric).toBe('carry');
    for (let week = 1; week <= 12; week++) {
      expect(resolvePrescription(carry, week)!.distanceM).toBe(30);
      expect(resolvePrescription(carry, week)!.perSide).toBe(true);
    }
  });
});

// SPEC-V4.0.md — running volume.
describe('the running weeks', () => {
  function setsAcrossBlock(id: string): number[] {
    const exercise = program.find((e) => e.id === id)!;
    return Array.from({ length: 12 }, (_, i) => resolvePrescription(exercise, i + 1)?.sets ?? 0);
  }

  it('builds the Sunday long run to eleven blocks in week 11', () => {
    // Base blocks; weeks 9-11 hand their closing blocks to the finish exercise.
    expect(setsAcrossBlock('sun-long-run')).toEqual([5, 6, 7, 5, 7, 8, 9, 6, 7, 8, 8, 8]);
  });

  it('adds a marathon-specific finish in weeks 9-11 only', () => {
    expect(setsAcrossBlock('sun-long-run-finish')).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 0]);
  });

  it('totals the long run to the plan\'s own block counts', () => {
    const base = setsAcrossBlock('sun-long-run');
    const finish = setsAcrossBlock('sun-long-run-finish');
    const total = base.map((b, i) => b + finish[i]);
    expect(total).toEqual([5, 6, 7, 5, 7, 8, 9, 6, 9, 10, 11, 8]);
    // 15 minutes a block — week 11 is the 165-minute long run.
    expect(total[10] * 15).toBe(165);
  });

  it('prescribes no Wednesday recovery run in weeks 1, 2 and 4', () => {
    expect(setsAcrossBlock('wed-recovery-run')).toEqual([0, 0, 2, 0, 2, 3, 3, 2, 3, 3, 3, 2]);
    expect(idsFor('wed', 'later', 1)).toEqual([]);
    expect(idsFor('wed', 'later', 4)).toEqual([]);
    expect(idsFor('wed', 'later', 5)).toEqual(['wed-recovery-run']);
  });

  it('runs Thursday and Saturday easy at their prescribed block counts', () => {
    expect(setsAcrossBlock('thu-easy-run')).toEqual([4, 4, 5, 4, 5, 5, 6, 4, 6, 6, 6, 4]);
    expect(setsAcrossBlock('sat-easy-run')).toEqual([4, 4, 4, 3, 4, 4, 5, 4, 5, 5, 4, 3]);
    expect(setsAcrossBlock('sat-strides')).toEqual([4, 4, 6, 4, 6, 6, 6, 4, 6, 6, 4, 4]);
  });

  it('builds the Tuesday threshold to five 8-minute reps', () => {
    expect(setsAcrossBlock('tue-threshold')).toEqual([3, 3, 4, 2, 4, 4, 5, 3, 5, 5, 4, 3]);
    const threshold = program.find((e) => e.id === 'tue-threshold')!;
    for (let week = 1; week <= 12; week++) {
      expect(resolvePrescription(threshold, week)!.minutesEach).toBe(8);
    }
  });

  it('keeps every run on the run RPE scale, so easy work can be logged at RPE 2', () => {
    for (const exercise of program.filter((e) => e.metric === 'runInterval')) {
      expect(exercise.rpeScale, exercise.id).toBe('run');
    }
    const recovery = program.find((e) => e.id === 'wed-recovery-run')!;
    expect(resolvePrescription(recovery, 5)!.rpeLow).toBe(2);
  });
});

// SPEC-V4.0.md — the two flexibility sessions.
describe('the flexibility sessions', () => {
  it('runs six items each, on the stretch RPE scale', () => {
    expect(idsFor('tue', 'later', 1)).toHaveLength(6);
    expect(idsFor('sun', 'later', 1)).toHaveLength(6);
    for (const day of ['tue', 'sun'] as DayId[]) {
      for (const exercise of exercisesFor(program, day, 'later', 1)) {
        expect(exercise.rpeScale, exercise.id).toBe('stretch');
      }
    }
  });

  it('never prescribes flexibility above RPE 8', () => {
    for (const exercise of program.filter((e) => e.rpeScale === 'stretch')) {
      for (let week = 1; week <= 12; week++) {
        const p = resolvePrescription(exercise, week);
        expect(p?.rpeHigh ?? 0, `${exercise.id} week ${week}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it('keeps Sunday lighter than Tuesday, so it stays a stretch and not a leg session', () => {
    const tue = program.find((e) => e.id === 'flexa-pancake-contract-relax')!;
    const sun = program.find((e) => e.id === 'flexb-pike')!;
    const total = (id: string) =>
      Array.from({ length: 12 }, (_, i) => resolvePrescription(program.find((e) => e.id === id)!, i + 1)!.sets).reduce(
        (a, b) => a + b,
        0,
      );
    expect(total(sun.id)).toBeLessThan(total(tue.id));
  });
});

// SPEC-V4.0.md — grease the groove is prescribed in ROUNDS of the whole list.
describe('the grease-the-groove blocks', () => {
  it('shares one rounds table across every GTG item', () => {
    const rounds = [2, 2, 3, 1, 3, 3, 3, 2, 3, 3, 2, 1];
    for (const exercise of program.filter((e) => e.block === 'am')) {
      const actual = Array.from({ length: 12 }, (_, i) => resolvePrescription(exercise, i + 1)!.sets);
      expect(actual, exercise.id).toEqual(rounds);
      expect(exercise.setsLabel, exercise.id).toBe('rounds');
    }
  });

  it('never prescribes GTG above RPE 5 — it is skill practice, not training', () => {
    for (const exercise of program.filter((e) => e.block === 'am')) {
      for (let week = 1; week <= 12; week++) {
        expect(resolvePrescription(exercise, week)!.rpeHigh, exercise.id).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('program integrity', () => {
  it('resolves a prescription for every exercise, every week', () => {
    const failures: string[] = [];
    for (const exercise of program) {
      for (let week = 1; week <= 12; week++) {
        if (resolvePrescription(exercise, week) === null) failures.push(`${exercise.id} (week ${week})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('gives every exercise a unique id and a unique slot within its session', () => {
    const ids = program.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const day of DAYS) {
      for (const block of BLOCKS) {
        const orders = program.filter((e) => e.day === day && e.block === block).map((e) => e.order);
        expect(new Set(orders).size, `${day}/${block}`).toBe(orders.length);
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
      // A skill pointing at a retired id could never gain another data point.
      expect(resolvePrescription(exercise!, 12)).not.toBeNull();
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

  it('warns about shoulders on the pressing days', () => {
    expect(jointVolumeWarning('shoulder', 'mon', sore('shoulderIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('shoulder', 'wed', sore('shoulderIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('shoulder', 'fri', sore('shoulderIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('shoulder', 'sat', sore('shoulderIrritation'))).toBeNull();
  });

  it('warns about elbows on the lever and pull days', () => {
    expect(jointVolumeWarning('elbow', 'wed', sore('elbowIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('elbow', 'fri', sore('elbowIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('elbow', 'thu', sore('elbowIrritation'))).toBeNull();
  });

  it('warns about the Achilles on every run day', () => {
    for (const day of ['tue', 'wed', 'thu', 'sat', 'sun'] as DayId[]) {
      expect(jointVolumeWarning('achilles', day, sore('achillesIrritation')), day).not.toBeNull();
    }
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
