import { describe, expect, it } from 'vitest';
import { dayTitles, program, sessionTitles } from '../program';
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
function table(id: string): [number, number, number][] {
  return WEEKS.map((week) => {
    const p = resolvePrescription(byId(id), week)!;
    return [p.sets, p.rpeLow!, p.rpeHigh!];
  });
}

// SPEC-V5.0.md section 2 — the weekly structure:
// Push / Pull / Legs / Rest / Push / Pull / Rest.
describe('the weekly structure', () => {
  it('runs grease-the-groove on Monday, Wednesday and Friday only', () => {
    expect(DAYS.filter((day) => idsFor(day, 'am', 1).length > 0)).toEqual(['mon', 'wed', 'fri']);
  });

  it('has a main session every day except Thursday, which is the rest day', () => {
    expect(DAYS.filter((day) => idsFor(day, 'main', 1).length > 0)).toEqual(['mon', 'tue', 'wed', 'fri', 'sat', 'sun']);
  });

  it('runs later sessions on Monday, Thursday, Friday and Sunday', () => {
    expect(DAYS.filter((day) => idsFor(day, 'later', 1).length > 0)).toEqual(['mon', 'thu', 'fri', 'sun']);
  });

  it('prescribes the same slots in every week — nothing opts out', () => {
    for (const week of WEEKS) {
      for (const day of DAYS) {
        for (const block of BLOCKS) {
          expect(idsFor(day, block, week), `${day}/${block} week ${week}`).toEqual(idsFor(day, block, 1));
        }
      }
    }
  });

  it('names every slot it prescribes, and nothing it does not', () => {
    for (const day of DAYS) {
      for (const block of BLOCKS) {
        const prescribed = exercisesFor(program, day, block, 1).length > 0;
        expect(!!sessionTitles[day][block], `${day}/${block}`).toBe(prescribed);
      }
    }
    expect(Object.keys(dayTitles).sort()).toEqual([...DAYS].sort());
  });
});

// The plan's per-day tables, transcribed exactly. One representative table per
// pattern is pinned in full; the shared tables are pinned by identity.
describe('Monday — Push A', () => {
  it('runs the five prescribed slots in order', () => {
    expect(idsFor('mon', 'main', 1)).toEqual([
      'hspu-primary',
      'ring-dip',
      'lateral-raise',
      'overhead-triceps-ext',
      'dragon-flag',
    ]);
  });

  it('prescribes the primary HSPU exactly as the plan\'s table', () => {
    expect(table('hspu-primary')).toEqual([
      [4, 8, 8],
      [4, 8, 8],
      [4, 8.5, 8.5],
      [5, 8.5, 8.5],
      [5, 8.5, 8.5],
      [3, 6, 7],
      [4, 8, 8],
      [4, 8.5, 8.5],
      [5, 8.5, 8.5],
      [5, 8.5, 8.5],
      [4, 8.5, 9],
      [3, 7, 8],
    ]);
    for (const week of WEEKS) {
      const p = resolvePrescription(byId('hspu-primary'), week)!;
      expect([p.repsLow, p.repsHigh], `week ${week} reps`).toEqual([4, 6]);
    }
    // "2–3 sets" in the deload and consolidation weeks is recorded, not rounded away.
    expect(resolvePrescription(byId('hspu-primary'), 6)!.note).toBe('2–3 sets');
    expect(resolvePrescription(byId('hspu-primary'), 12)!.note).toBe('2–3 sets');
  });

  it('prescribes the weighted ring dip identically on Monday and Friday', () => {
    expect(table('ring-dip-secondary')).toEqual(table('ring-dip'));
    expect(table('ring-dip')[5]).toEqual([2, 6, 7]); // week 6 deload
  });

  it('runs the moderate cardio as one continuous block, building to 30 minutes', () => {
    const minutes = WEEKS.map((week) => resolvePrescription(byId('mon-moderate-cardio'), week)!.minutesEach);
    expect(minutes).toEqual([20, 22, 24, 26, 28, 18, 24, 26, 28, 30, 30, 25]);
    expect(byId('mon-moderate-cardio').rpeScale).toBe('run');
    expect(resolvePrescription(byId('mon-moderate-cardio'), 6)!.note).toBe('15–18 min');
  });
});

describe('Tuesday — Pull A', () => {
  it('leads with the hard front-lever isometric, held 5–8 s', () => {
    expect(idsFor('tue', 'main', 1)).toEqual([
      'fl-hold-primary',
      'fl-raise',
      'rear-delt-fly',
      'wall-curl',
      'standing-ab-wheel',
    ]);
    const p = resolvePrescription(byId('fl-hold-primary'), 1)!;
    expect([p.secLow, p.secHigh]).toEqual([5, 8]);
  });

  it('shares the accessory table across every upper-body accessory in the block', () => {
    const reference = table('lateral-raise');
    for (const id of ['overhead-triceps-ext', 'rear-delt-fly', 'wall-curl', 'lateral-raise-c', 'cable-triceps-ext', 'hammer-curl']) {
      expect(table(id), id).toEqual(reference);
    }
    expect(reference[4]).toEqual([4, 9, 9]); // week 5 is the first RPE 9
    expect(reference[5]).toEqual([2, 6, 7]); // deload
  });
});

describe('Wednesday — Legs', () => {
  it('runs three serious exercises then two lower-leg movements', () => {
    expect(idsFor('wed', 'main', 1)).toEqual([
      'hack-squat',
      'bulgarian-split-squat',
      'nordic-curl',
      'calf-raise-b',
      'tibialis-raise',
    ]);
  });

  it('shares the lower-body table across the four accessories and the wiper', () => {
    const reference = table('bulgarian-split-squat');
    for (const id of ['nordic-curl', 'calf-raise-b', 'tibialis-raise', 'windshield-wiper']) {
      expect(table(id), id).toEqual(reference);
    }
    expect(reference[5]).toEqual([2, 6, 6]);
    expect(reference[11]).toEqual([2, 7, 7]);
  });
});

describe('Friday — Push B and HIIT', () => {
  it('runs the dip first, the wall-assisted HSPU second, and a core superset last', () => {
    expect(idsFor('fri', 'main', 1)).toEqual([
      'ring-dip-secondary',
      'hspu-secondary',
      'lateral-raise-c',
      'cable-triceps-ext',
      'cable-crunch',
      'weighted-side-plank',
    ]);
    expect(byId('cable-crunch').supersetId).toBe('fri-5');
    expect(byId('weighted-side-plank').supersetId).toBe('fri-5');
  });

  it('builds HIIT to eight 30-second intervals, on the run scale with 90 s rest', () => {
    const intervals = byId('fri-hiit-intervals');
    expect(intervals.rpeScale).toBe('run');
    expect(intervals.restSeconds).toBe(90);
    expect(WEEKS.map((week) => resolvePrescription(intervals, week)!.sets)).toEqual([5, 6, 6, 7, 8, 4, 6, 7, 8, 8, 8, 5]);
    expect(resolvePrescription(intervals, 10)!.rpeLow).toBe(9.5);
    expect(idsFor('fri', 'later', 1)).toEqual(['fri-hiit-warmup', 'fri-hiit-intervals', 'fri-hiit-cooldown']);
  });
});

describe('Saturday — Pull B', () => {
  it('keeps the banded lever hold deliberately easier than Tuesday\'s', () => {
    expect(idsFor('sat', 'main', 1)).toEqual([
      'fl-hold-banded',
      'ring-pullup',
      'fl-row-banded',
      'hammer-curl',
      'windshield-wiper',
    ]);
    for (const week of WEEKS) {
      const banded = resolvePrescription(byId('fl-hold-banded'), week)!;
      const hard = resolvePrescription(byId('fl-hold-primary'), week)!;
      expect(banded.rpeHigh, `week ${week}`).toBeLessThanOrEqual(hard.rpeHigh!);
    }
  });

  it('prescribes the weighted pull-up at 3–5 reps to the plan\'s table', () => {
    const p = resolvePrescription(byId('ring-pullup'), 1)!;
    expect([p.repsLow, p.repsHigh]).toEqual([3, 5]);
    expect(table('ring-pullup')[10]).toEqual([4, 8.5, 9]);
  });
});

describe('Sunday — long cardio and Flexibility B', () => {
  it('builds the long session to 80–90 minutes in week 11', () => {
    const minutes = WEEKS.map((week) => resolvePrescription(byId('sun-long-cardio'), week)!.minutesEach);
    expect(minutes).toEqual([45, 50, 55, 60, 65, 45, 60, 65, 70, 75, 90, 60]);
    expect(resolvePrescription(byId('sun-long-cardio'), 11)!.note).toBe('80–90 min');
    expect(byId('sun-long-cardio').rpeScale).toBe('run');
  });
});

describe('the flexibility sessions', () => {
  it('runs six items each, on the stretch RPE scale', () => {
    for (const [day, block] of [['thu', 'later'], ['sun', 'later']] as [DayId, Block][]) {
      const items = exercisesFor(program, day, block, 1);
      expect(items, `${day}/${block}`).toHaveLength(6);
      for (const item of items) expect(item.rpeScale, item.id).toBe('stretch');
    }
  });

  it('never prescribes flexibility above RPE 7.5', () => {
    for (const exercise of program.filter((e) => e.rpeScale === 'stretch')) {
      for (const week of WEEKS) {
        expect(resolvePrescription(exercise, week)!.rpeHigh, `${exercise.id} week ${week}`).toBeLessThanOrEqual(7.5);
      }
    }
  });

  it('gives Flexibility A separate set counts for loaded movements and static holds', () => {
    // Week 3: loaded 3, static 2. Week 5: both 3.
    expect(resolvePrescription(byId('flexa-cossack'), 3)!.sets).toBe(3);
    expect(resolvePrescription(byId('flexa-middle-split'), 3)!.sets).toBe(2);
    expect(resolvePrescription(byId('flexa-cossack'), 5)!.sets).toBe(3);
    expect(resolvePrescription(byId('flexa-middle-split'), 5)!.sets).toBe(3);
  });

  it('records the range on holds the plan prescribes as a range', () => {
    const p = resolvePrescription(byId('flexb-half-split'), 1)!;
    expect([p.secLow, p.secHigh, p.perSide]).toEqual([45, 60, true]);
  });
});

describe('the grease-the-groove blocks', () => {
  it('shares one rounds table across every GTG item', () => {
    const expected = [2, 2, 2, 3, 3, 1, 2, 2, 3, 3, 2, 2];
    for (const exercise of program.filter((e) => e.block === 'am')) {
      expect(exercise.setsLabel, exercise.id).toBe('rounds');
      expect(WEEKS.map((week) => resolvePrescription(exercise, week)!.sets), exercise.id).toEqual(expected);
      expect(resolvePrescription(exercise, 12)!.note, exercise.id).toBe('1–2 rounds');
    }
  });

  it('never prescribes GTG above RPE 5 — it is skill practice, not training', () => {
    for (const exercise of program.filter((e) => e.block === 'am')) {
      for (const week of WEEKS) {
        expect(resolvePrescription(exercise, week)!.rpeHigh, `${exercise.id} week ${week}`).toBeLessThanOrEqual(5);
      }
    }
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

  it('warns about shoulders on the two push days and the rear-delt pull day', () => {
    expect(jointVolumeWarning('shoulder', 'mon', sore('shoulderIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('shoulder', 'tue', sore('shoulderIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('shoulder', 'fri', sore('shoulderIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('shoulder', 'wed', sore('shoulderIrritation'))).toBeNull();
    expect(jointVolumeWarning('shoulder', 'thu', sore('shoulderIrritation'))).toBeNull();
  });

  it('warns about elbows on the lever and pull days, and the triceps push days', () => {
    expect(jointVolumeWarning('elbow', 'tue', sore('elbowIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('elbow', 'sat', sore('elbowIrritation'))).not.toBeNull();
    expect(jointVolumeWarning('elbow', 'thu', sore('elbowIrritation'))).toBeNull();
  });

  it('warns about the Achilles on the three cardio days and the calf day', () => {
    for (const day of ['mon', 'wed', 'fri', 'sun'] as DayId[]) {
      expect(jointVolumeWarning('achilles', day, sore('achillesIrritation')), day).not.toBeNull();
    }
    expect(jointVolumeWarning('achilles', 'tue', sore('achillesIrritation'))).toBeNull();
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
