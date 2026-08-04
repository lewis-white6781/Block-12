// Monday's v3.0 main block — SPEC-V3.0.md section 3, acceptance tests 61-63.
import { describe, expect, it } from 'vitest';
import { program } from '../program';
import { retiredExercises } from '../retiredExercises';
import { resolvePrescription } from '../../domain/phase';
import { SKILLS } from '../../domain/analysis';
import type { Exercise } from '../../domain/types';

const mondayMain = program
  .filter((e) => e.day === 'mon' && e.block === 'main')
  .sort((a, b) => a.order - b.order);

function byId(id: string): Exercise {
  const found = program.find((e) => e.id === id);
  if (!found) throw new Error(`${id} is not in the program`);
  return found;
}

describe('Monday main slot order', () => {
  it('runs partial wall HSPU, pike HSPU, belly-to-wall negative, ring dip, pike compression', () => {
    expect(mondayMain.map((e) => e.id)).toEqual([
      'wall-hspu-partial',
      'pike-hspu',
      'belly-wall-hspu-negative',
      'ring-dip',
      'pike-compression',
      'optional-run',
    ]);
  });

  it('no longer prescribes either retired exercise', () => {
    const ids = program.map((e) => e.id);
    expect(ids).not.toContain('hs-balance-primary');
    expect(ids).not.toContain('press-to-hs');
  });

  it('keeps both retired exercises resolvable', () => {
    expect(retiredExercises.map((e) => e.id).sort()).toEqual(['hs-balance-primary', 'press-to-hs']);
  });
});

describe('slot 1 — Partial ROM wall HSPU (acceptance test 61)', () => {
  const ex = byId('wall-hspu-partial');

  it('is rep-judged, not time-judged, and sits on the hspu ladder', () => {
    expect(ex.name).toBe('Partial ROM wall HSPU');
    expect(ex.metric).toBe('reps');
    expect(ex.ladderId).toBe('hspu');
    expect(ex.tracked).toBe(true);
  });

  it('prescribes 4 sets of 3-5 at RPE 7 in week 1', () => {
    expect(resolvePrescription(ex, 1)).toMatchObject({ sets: 4, repsLow: 3, repsHigh: 5, rpeLow: 7, rpeHigh: 7 });
  });

  it('prescribes 5 sets of 5-7 at RPE 8 in week 8', () => {
    expect(resolvePrescription(ex, 8)).toMatchObject({ sets: 5, repsLow: 5, repsHigh: 7, rpeLow: 8, rpeHigh: 8 });
  });

  it('stays inside 3-8 reps across the whole block', () => {
    for (let week = 1; week <= 12; week++) {
      const p = resolvePrescription(ex, week);
      if (p?.repsLow === undefined) continue;
      expect(p.repsLow).toBeGreaterThanOrEqual(3);
      expect(p.repsHigh ?? p.repsLow).toBeLessThanOrEqual(8);
    }
  });

  it('progresses on ROM, which is what shows the depth input', () => {
    expect(ex.progressionLadder).toContain('greater ROM');
  });

  it('carries a depth stop rule', () => {
    expect(ex.stopRules).toContain('depth reduced from the first rep');
  });
});

describe('slot 3 — Belly-to-wall HSPU negative (acceptance test 62)', () => {
  const ex = byId('belly-wall-hspu-negative');

  it('is rep-judged and sits on the hspu ladder', () => {
    expect(ex.name).toBe('Belly-to-wall HSPU negative');
    expect(ex.metric).toBe('reps');
    expect(ex.ladderId).toBe('hspu');
    expect(ex.tracked).toBe(true);
  });

  it('prescribes 3 sets of 5-8 at RPE 7 in week 1', () => {
    expect(resolvePrescription(ex, 1)).toMatchObject({ sets: 3, repsLow: 5, repsHigh: 8, rpeLow: 7, rpeHigh: 7 });
  });

  it('targets strictly more reps than slot 1 in every week that prescribes both', () => {
    const slot1 = byId('wall-hspu-partial');
    for (let week = 1; week <= 12; week++) {
      const a = resolvePrescription(slot1, week);
      const b = resolvePrescription(ex, week);
      if (a?.repsLow === undefined || b?.repsLow === undefined) continue;
      expect(b.repsLow).toBeGreaterThan(a.repsLow);
      expect(b.repsHigh ?? b.repsLow).toBeGreaterThan(a.repsHigh ?? a.repsLow);
    }
  });

  it('progresses on ROM and on lowering speed', () => {
    expect(ex.progressionLadder).toContain('greater ROM');
    expect(ex.progressionLadder).toContain('slower lower');
  });
});

describe('what v3.0 must NOT have touched (acceptance test 63)', () => {
  it('leaves pike HSPU week 1 at 4x4-6 RPE 7', () => {
    expect(resolvePrescription(byId('pike-hspu'), 1)).toMatchObject({
      sets: 4,
      repsLow: 4,
      repsHigh: 6,
      rpeLow: 7,
      rpeHigh: 7,
    });
  });

  it('leaves ring dip week 1 at 3x6-8 RPE 7', () => {
    expect(resolvePrescription(byId('ring-dip'), 1)).toMatchObject({ sets: 3, repsLow: 6, repsHigh: 8, rpeLow: 7 });
  });

  it('leaves pike compression week 1 at 4x8-15', () => {
    expect(resolvePrescription(byId('pike-compression'), 1)).toMatchObject({ sets: 4, repsLow: 8, repsHigh: 15 });
  });

  it('leaves the Monday AM block at six exercises, all tracked', () => {
    const am = program.filter((e) => e.day === 'mon' && e.block === 'am');
    expect(am).toHaveLength(6);
    expect(am.every((e) => e.tracked)).toBe(true);
    expect(am.find((e) => e.id === 'toe-pulls')?.ladderId).toBe('handstandEntry');
  });
});

describe('the HSPU headline skill', () => {
  it('points at an exercise that is still prescribed, so it can still gain data', () => {
    const hspu = SKILLS.find((s) => s.id === 'hspu');
    expect(hspu?.exerciseId).toBe('wall-hspu-partial');
    expect(program.some((e) => e.id === hspu?.exerciseId)).toBe(true);
  });

  it('holds for every skill, not just HSPU', () => {
    for (const skill of SKILLS) {
      expect(program.some((e) => e.id === skill.exerciseId)).toBe(true);
    }
  });
});
