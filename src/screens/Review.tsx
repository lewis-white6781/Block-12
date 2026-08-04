// SPEC.md section 7.6.
import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { program } from '../data/program';
import { ladders } from '../data/ladders';
import { targets } from '../data/targets';
import { weeklyProgressionVariables } from '../data/mobility';
import { currentWeek, phaseForWeek } from '../domain/phase';
import { startOfToday, todayISO } from '../domain/clock';
import { rolling7Weight } from '../domain/body';
import { fmt } from '../domain/format';
import { fmtKg, fmtKgSigned } from '../domain/units';
import { buildExerciseHistory, computeSetScore, exerciseProgressIndex } from '../domain/scoring';
import { buildWeeklyReview, checkEndOfBlockTargets } from '../domain/review';
import type { TargetStatus } from '../domain/review';
import BenchmarkForm from '../components/BenchmarkForm';
import PhaseBadge from '../components/PhaseBadge';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import PagerNav from '../components/PagerNav';
import Stat from '../components/Stat';

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
    <div className="flex h-full flex-col">
      <PhaseBadge week={selectedWeek} phase={phaseForWeek(selectedWeek)} dateLabel="Review" />

      <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-text">Review</h1>
        <PagerNav
          onPrev={() => setSelectedWeek((w) => w - 1)}
          onNext={() => setSelectedWeek((w) => w + 1)}
          disablePrev={selectedWeek <= 1}
          disableNext={selectedWeek >= 12}
          center={<span className="tabular-nums text-sm text-muted">Week {selectedWeek}</span>}
        />
      </div>

      <Card className="mt-4">
        <SectionHeader>Sessions</SectionHeader>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="Main" value={`${review.sessionsCompleted.main}/${review.sessionsPlanned.main}`} />
          <Stat label="AM" value={`${review.sessionsCompleted.am}/${review.sessionsPlanned.am}`} />
        </div>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Weight</SectionHeader>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat
            label="Mean"
            value={
              review.weight.meanKg !== null
                ? `${fmtKg(review.weight.meanKg, settings.weightUnit)} ${settings.weightUnit}`
                : '—'
            }
          />
          <Stat
            label="Rate"
            value={
              review.weight.rateKgPerWeek !== null
                ? `${fmtKgSigned(review.weight.rateKgPerWeek, settings.weightUnit)} ${settings.weightUnit}/wk`
                : '—'
            }
          />
          <Stat label="Status" value={review.weight.status ? CORRIDOR_COPY[review.weight.status] : '—'} />
        </div>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Nutrition</SectionHeader>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="Protein in range" value={`${review.nutrition.proteinAdherenceDays}/7 days`} />
          <Stat
            label="Mean kcal"
            value={review.nutrition.meanCalories !== null ? fmt(review.nutrition.meanCalories, 0) : '—'}
          />
          <Stat
            label="Mean carbs"
            value={review.nutrition.meanCarbsG !== null ? `${fmt(review.nutrition.meanCarbsG, 0)} g` : '—'}
          />
          <Stat
            label="Mean fat"
            value={review.nutrition.meanFatG !== null ? `${fmt(review.nutrition.meanFatG, 0)} g` : '—'}
          />
        </div>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Skill Progress Index — this week</SectionHeader>
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
      </Card>

      <Card className="mt-4">
        <SectionHeader>Fired flags</SectionHeader>
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
      </Card>

      {review.nextWeek && (
        <Card className="mt-4">
          <SectionHeader>
            Next week's focus — week {review.nextWeek.week} {review.nextWeek.phase.toUpperCase()}
          </SectionHeader>
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
        </Card>
      )}

      {review.benchmarkWeek && (
        <section className="mt-4">
          <BenchmarkForm week={selectedWeek} />
        </section>
      )}

      {targetChecklist && (
        <Card className="mt-4">
          <SectionHeader>Week-12 target checklist</SectionHeader>
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
        </Card>
      )}
      </div>
    </div>
  );
}
