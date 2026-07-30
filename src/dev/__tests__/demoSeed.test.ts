import { describe, expect, it } from 'vitest';
import { generateDemoState } from '../demoSeed';
import { program } from '../../data/program';
import { ladders } from '../../data/ladders';
import { weeklyProgressionVariables } from '../../data/mobility';
import { corridorStatus, rolling7Weight, weeklyRateKg } from '../../domain/body';
import { buildExerciseHistory, computeSetScore, exerciseProgressIndex } from '../../domain/scoring';
import { buildWeeklyReview } from '../../domain/review';

// Sanity check for SPEC.md prompt pack 11.2 Prompt 8: confirms the demo
// dataset actually exercises the stagnation detector, corridor status, and
// Progress Index — not just that it renders without crashing.
describe('generateDemoState', () => {
  const state = generateDemoState();

  it('produces 6 weeks of main + AM sessions and daily entries', () => {
    const mainSessions = Object.values(state.sessionLogs).filter((s) => s.block === 'main');
    const amSessions = Object.values(state.sessionLogs).filter((s) => s.block === 'am');
    expect(mainSessions.length).toBeGreaterThan(0);
    expect(amSessions.length).toBeGreaterThan(0);
    expect(Object.keys(state.dailyEntries).length).toBe(42);
  });

  it('fires the stagnation detector for the deliberately flat exercise', () => {
    // Week 6 is deload, where the stagnation detector is intentionally
    // suppressed (SPEC.md 6.7) — check the last accumulation week instead.
    const week = 5;
    const review = buildWeeklyReview({
      week,
      settings: state.settings,
      program,
      ladders,
      sessionLogs: state.sessionLogs,
      dailyEntries: state.dailyEntries,
      progressionEvents: state.progressionEvents,
      mobilityVariableForWeek: (w) => weeklyProgressionVariables.find((v) => v.week === w)?.description ?? null,
    });
    const stagnant = review.firedFlags.stagnation.find((s) => s.exerciseId === 'hs-balance-primary');
    expect(stagnant).toBeDefined();
    expect(stagnant?.type).toBe('stagnant');
  });

  it('reports a corridor status derived from the seeded weight trend', () => {
    const entries = Object.values(state.dailyEntries);
    const asOfDate = Object.keys(state.dailyEntries).sort().at(-1)!;
    const rate = weeklyRateKg(entries, asOfDate);
    expect(rate).not.toBeNull();
    expect(rolling7Weight(entries, asOfDate)).not.toBeNull();
    expect(corridorStatus(rate)).not.toBeNull();
  });

  it('shows a rising Progress Index for a non-stagnant skill exercise', () => {
    const exercise = program.find((e) => e.id === 'fl-hard-iso')!;
    const ladder = ladders.find((l) => l.id === exercise.ladderId);
    const dailyEntriesArray = Object.values(state.dailyEntries);
    const history = buildExerciseHistory(state.sessionLogs, exercise.id, (set, date) =>
      computeSetScore(exercise, ladder, set, rolling7Weight(dailyEntriesArray, date) ?? state.settings.startWeightKg),
    );
    const index = exerciseProgressIndex(history);
    expect(index).not.toBeNull();
    expect(index as number).toBeGreaterThan(100);
  });

  it('keeps the stagnant exercise flat rather than improving', () => {
    const exercise = program.find((e) => e.id === 'hs-balance-primary')!;
    const ladder = ladders.find((l) => l.id === exercise.ladderId);
    const dailyEntriesArray = Object.values(state.dailyEntries);
    const history = buildExerciseHistory(state.sessionLogs, exercise.id, (set, date) =>
      computeSetScore(exercise, ladder, set, rolling7Weight(dailyEntriesArray, date) ?? state.settings.startWeightKg),
    );
    const index = exerciseProgressIndex(history);
    expect(index).not.toBeNull();
    // Flat by design: within a few % of baseline, not trending up like the other skills.
    expect(index as number).toBeLessThan(108);
  });
});
