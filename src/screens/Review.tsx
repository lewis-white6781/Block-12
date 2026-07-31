// SPEC.md section 7.6.
import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { program } from '../data/program';
import { ladders } from '../data/ladders';
import { targets } from '../data/targets';
import { weeklyProgressionVariables } from '../data/mobility';
import { currentWeek } from '../domain/phase';
import { startOfToday, todayISO } from '../domain/clock';
import { rolling7Weight } from '../domain/body';
import { buildExerciseHistory, computeSetScore, exerciseProgressIndex } from '../domain/scoring';
import { buildWeeklyReview, checkEndOfBlockTargets } from '../domain/review';
import type { TargetStatus } from '../domain/review';
import BenchmarkForm from '../components/BenchmarkForm';

const CORRIDOR_COPY: Record<string, string> = {
  onTrack: 'On track',
  tooSlow: 'Slower than planned',
  tooFast: 'Faster than planned — risk to lean mass and skill output',
};

const STATUS_ICON: Record<TargetStatus, string> = { met: '✓', unmet: '✗', unknown: '—' };
const STATUS_CLASS: Record<TargetStatus, string> = { met: 'text-good', unmet: 'text-bad', unknown: 'text-muted' };

export default function Review() {
  const settings = useStore((s) => s.settings);
  const sessionLogs = useStore((s) => s.sessionLogs);
  const dailyEntries = useStore((s) => s.dailyEntries);
  const benchmarkEntries = useStore((s) => s.benchmarkEntries);
  const progressionEvents = useStore((s) => s.progressionEvents);

  const [selectedWeek, setSelectedWeek] = useState(() => currentWeek(startOfToday(), settings.blockStartDate));
  const dailyEntriesArray = useMemo(() => Object.values(dailyEntries), [dailyEntries]);

  const review = useMemo(
    () =>
      buildWeeklyReview({
        week: selectedWeek,
        settings,
        program,
        ladders,
        sessionLogs,
        dailyEntries,
        progressionEvents,
        mobilityVariableForWeek: (w) => weeklyProgressionVariables.find((v) => v.week === w)?.description ?? null,
      }),
    [selectedWeek, settings, sessionLogs, dailyEntries, progressionEvents],
  );

  function week12ProgressIndex(exerciseId: string): number | null {
    const exercise = program.find((e) => e.id === exerciseId);
    if (!exercise) return null;
    const ladder = exercise.ladderId ? ladders.find((l) => l.id === exercise.ladderId) : undefined;
    const history = buildExerciseHistory(sessionLogs, exercise.id, (set, date) =>
      computeSetScore(exercise, ladder, set, rolling7Weight(dailyEntriesArray, date) ?? settings.startWeightKg),
    );
    return exerciseProgressIndex(history);
  }

  const targetChecklist =
    selectedWeek === 12
      ? checkEndOfBlockTargets({
          targetGroups: targets,
          sessionLogs,
          dailyEntries,
          benchmarkEntries,
          settings,
          week12ProgressIndex,
          asOfDate: todayISO(),
        })
      : null;

  const totalFired =
    review.firedFlags.stagnation.length +
    review.firedFlags.guardrails.length +
    review.firedFlags.stopRules.length +
    review.firedFlags.oneVariableOverrides;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-text">Review</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={selectedWeek <= 1}
            onClick={() => setSelectedWeek((w) => w - 1)}
            className="min-h-11 min-w-11 text-text disabled:opacity-30"
          >
            ←
          </button>
          <span className="tabular-nums text-sm text-muted">Week {selectedWeek}</span>
          <button
            type="button"
            disabled={selectedWeek >= 12}
            onClick={() => setSelectedWeek((w) => w + 1)}
            className="min-h-11 min-w-11 text-text disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">Sessions</span>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted">Main</div>
            <div className="font-display text-2xl tabular-nums text-text">
              {review.sessionsCompleted.main}/{review.sessionsPlanned.main}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">AM</div>
            <div className="font-display text-2xl tabular-nums text-text">
              {review.sessionsCompleted.am}/{review.sessionsPlanned.am}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">Weight</span>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted">Mean</div>
            <div className="tabular-nums text-text">{review.weight.meanKg !== null ? `${review.weight.meanKg.toFixed(1)} kg` : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Rate</div>
            <div className="tabular-nums text-text">
              {review.weight.rateKgPerWeek !== null
                ? `${review.weight.rateKgPerWeek <= 0 ? '−' : '+'}${Math.abs(review.weight.rateKgPerWeek).toFixed(2)} kg/wk`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Status</div>
            <div className="text-text">{review.weight.status ? CORRIDOR_COPY[review.weight.status] : '—'}</div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">Nutrition</span>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted">Protein in range</div>
            <div className="tabular-nums text-text">{review.nutrition.proteinAdherenceDays}/7 days</div>
          </div>
          <div>
            <div className="text-xs text-muted">Mean kcal</div>
            <div className="tabular-nums text-text">{review.nutrition.meanCalories !== null ? review.nutrition.meanCalories.toFixed(0) : '—'}</div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">Skill Progress Index — this week</span>
        <ul className="mt-2 space-y-1 text-sm">
          {review.skillDeltas.map(({ skill, progressIndex, deltaVsLastWeek }) => (
            <li key={skill.id} className="flex items-center justify-between">
              <span className="text-text">{skill.label}</span>
              <span className="tabular-nums text-muted">
                {progressIndex !== null ? progressIndex.toFixed(0) : '—'}
                {deltaVsLastWeek !== null && (
                  <span className={deltaVsLastWeek >= 0 ? 'text-good' : 'text-bad'}>
                    {' '}
                    ({deltaVsLastWeek >= 0 ? '+' : ''}
                    {deltaVsLastWeek.toFixed(0)})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">Fired flags</span>
        {totalFired === 0 ? (
          <p className="mt-2 text-xs text-muted">Nothing fired this week.</p>
        ) : (
          <div className="mt-2 space-y-2 text-sm">
            {review.firedFlags.stagnation.map((s, i) => (
              <div key={`stag-${i}`} className={`rounded px-2 py-1 ${s.type === 'stagnant' ? 'bg-warn text-bg' : 'bg-surface-2 text-text'}`}>
                {s.message}
              </div>
            ))}
            {review.firedFlags.guardrails.map((g, i) => (
              <div key={`guard-${i}`} className="rounded bg-warn px-2 py-1 text-bg">
                {g.message}
              </div>
            ))}
            {review.firedFlags.stopRules.map((s, i) => (
              <div
                key={`stop-${i}`}
                className={`rounded px-2 py-1 ${s.result.severity === 'red' ? 'bg-bad text-bg' : 'bg-warn text-bg'}`}
              >
                {program.find((e) => e.id === s.exerciseId)?.name ?? s.exerciseId}: {s.result.message}
              </div>
            ))}
            {review.firedFlags.oneVariableOverrides > 0 && (
              <div className="rounded bg-surface-2 px-2 py-1 text-text">
                {review.firedFlags.oneVariableOverrides} one-variable-rule override
                {review.firedFlags.oneVariableOverrides === 1 ? '' : 's'} this week.
              </div>
            )}
          </div>
        )}
      </section>

      {review.nextWeek && (
        <section className="mt-4 rounded border border-line bg-surface p-3">
          <span className="text-sm text-text">
            Next week's focus — week {review.nextWeek.week} {review.nextWeek.phase.toUpperCase()}
          </span>
          <p className="mt-2 text-sm text-text">{review.nextWeek.phaseNote}</p>
          {review.nextWeek.mobilityVariable && (
            <p className="mt-1 text-xs text-muted">Mobility: {review.nextWeek.mobilityVariable}</p>
          )}
          {review.nextWeek.suggestedProgressions.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-text">
              {review.nextWeek.suggestedProgressions.map((s) => (
                <li key={s.exerciseId}>{s.message}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {review.benchmarkWeek && (
        <section className="mt-4">
          <BenchmarkForm week={selectedWeek} />
        </section>
      )}

      {targetChecklist && (
        <section className="mt-4 rounded border border-line bg-surface p-3">
          <span className="text-sm text-text">Week-12 target checklist</span>
          <div className="mt-2 space-y-3">
            {targetChecklist.map((group) => (
              <div key={group.id}>
                <div className="text-xs uppercase tracking-wide text-muted">{group.label}</div>
                <ul className="mt-1 space-y-1">
                  {group.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={STATUS_CLASS[item.status]}>{STATUS_ICON[item.status]}</span>
                      <span className="text-text">{item.item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
