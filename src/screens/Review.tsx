// SPEC.md section 7.6.
import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { program } from '../data/program';
import { exerciseName } from '../data/exercises';
import { ladders } from '../data/ladders';
import { targets } from '../data/targets';
import { weeklyProgressionVariables } from '../data/mobility';
import { currentWeek, phaseForWeek } from '../domain/phase';
import { useToday } from '../hooks/useToday';
import { fmt } from '../domain/format';
import { fmtKg, fmtKgSigned } from '../domain/units';
import { bestBySession, bestOf, formatBest, trendArrow } from '../domain/performance';
import { buildWeeklyReview, checkEndOfBlockTargets } from '../domain/review';
import type { TargetStatus } from '../domain/review';
import { buildWeekCoverage } from '../domain/coverage';
import { dueFollowUps, weekDecisionCounts } from '../domain/decisions';
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
  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const sessionLogs = useStore((s) => s.sessionLogs);
  const dailyEntries = useStore((s) => s.dailyEntries);
  const benchmarkEntries = useStore((s) => s.benchmarkEntries);
  const progressionEvents = useStore((s) => s.progressionEvents);
  const decisionEntries = useStore((s) => s.decisionEntries);

  const today = useToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const [selectedWeek, setSelectedWeek] = useState(() => currentWeek(today, settings.blockStartDate));

  // v5.1 analytics: what the week's data can and cannot say. 'unknown' slots
  // are dates that passed with nothing recorded — visible, and never counted
  // as "missed".
  const coverage = useMemo(
    () =>
      buildWeekCoverage({
        week: selectedWeek,
        blockStartDate: settings.blockStartDate,
        todayISO: todayStr,
        program,
        sessionLogs,
        dailyEntries,
      }),
    [selectedWeek, settings.blockStartDate, todayStr, sessionLogs, dailyEntries],
  );

  const decisions = useMemo(() => {
    const weekStart = format(addDays(parseISO(settings.blockStartDate), (selectedWeek - 1) * 7), 'yyyy-MM-dd');
    const weekEnd = format(addDays(parseISO(settings.blockStartDate), selectedWeek * 7 - 1), 'yyyy-MM-dd');
    return {
      counts: weekDecisionCounts(decisionEntries, weekStart, weekEnd),
      due: dueFollowUps(decisionEntries, sessionLogs, todayStr),
    };
  }, [decisionEntries, sessionLogs, settings.blockStartDate, selectedWeek, todayStr]);

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

  /**
   * Best of the last 3 sessions as a percentage of the weeks 1-2 baseline, in
   * the movement's own unit. v3.0 replacement for the Exercise Progress Index
   * (SPEC-V3.0.md section 1): the "broadly maintained" / "no decline" week-12
   * targets genuinely want a ratio, they just no longer want a difficulty
   * multiplier inside it.
   */
  function week12RetentionPct(exerciseId: string): number | null {
    const exercise = program.find((e) => e.id === exerciseId);
    if (!exercise) return null;
    const history = bestBySession(sessionLogs, exercise);
    const baseline = bestOf(history.filter((h) => h.week <= 2).map((h) => h.best));
    const current = bestOf(history.slice(-3).map((h) => h.best));
    if (!baseline || !current || baseline.value === 0) return null;
    return (current.value / baseline.value) * 100;
  }

  const targetChecklist =
    selectedWeek === 12
      ? checkEndOfBlockTargets({
          targetGroups: targets,
          sessionLogs,
          dailyEntries,
          benchmarkEntries,
          settings,
          week12RetentionPct,
          asOfDate: format(today, 'yyyy-MM-dd'),
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
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat label="Main" value={`${review.sessionsCompleted.main}/${review.sessionsPlanned.main}`} />
          <Stat label="AM" value={`${review.sessionsCompleted.am}/${review.sessionsPlanned.am}`} />
          <Stat label="Later" value={`${review.sessionsCompleted.later}/${review.sessionsPlanned.later}`} />
        </div>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Data coverage</SectionHeader>
        <p className="mt-1 text-xs text-muted">
          What this week's numbers are based on. A day with nothing recorded is unknown — not
          evidence of a missed session.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat label="Weight" value={`${coverage.weightDays}/7 days`} />
          <Stat label="Calories" value={`${coverage.nutritionDays}/7 days`} />
          <Stat
            label="Sessions"
            value={`${coverage.completed + coverage.loggedOnly}/${coverage.planned}`}
            sublabel={
              coverage.unknown > 0 || coverage.upcoming > 0
                ? `${coverage.unknown} unknown${coverage.upcoming > 0 ? `, ${coverage.upcoming} upcoming` : ''}`
                : undefined
            }
          />
        </div>
        {coverage.retrospectiveEntries > 0 && (
          <p className="mt-2 text-xs text-muted">
            {coverage.retrospectiveEntries} daily entr{coverage.retrospectiveEntries === 1 ? 'y' : 'ies'} entered
            after the day {coverage.retrospectiveEntries === 1 ? 'it describes' : 'they describe'}.
          </p>
        )}
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
        <SectionHeader>Skills — this week</SectionHeader>
        <ul className="mt-2 space-y-1 text-sm">
          {review.skillDeltas.map(({ skill, current, previous, trend }) => (
            <li key={skill.id} className="flex items-center justify-between gap-2">
              <span className="text-text">{skill.label}</span>
              <span className="tabular-nums text-muted">
                {previous && current && previous.value !== current.value
                  ? `${formatBest(previous)} → `
                  : ''}
                <span className="text-text">{formatBest(current)}</span>{' '}
                <span className={trend === 'up' ? 'text-good' : trend === 'down' ? 'text-bad' : 'text-muted'}>
                  {trendArrow(trend)}
                </span>
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
                {exerciseName(s.exerciseId)}: {s.result.message}
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

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <SectionHeader>Decisions</SectionHeader>
          <button
            type="button"
            onClick={() => navigate('/decisions')}
            className="min-h-11 rounded border border-line px-3 text-xs text-text"
          >
            Open journal
          </button>
        </div>
        {decisions.counts.total === 0 ? (
          <p className="mt-2 text-xs text-muted">No decisions recorded this week.</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="Recorded" value={String(decisions.counts.total)} />
            <Stat label="Accepted" value={String(decisions.counts.accepted)} />
            <Stat label="Overridden" value={String(decisions.counts.overriddenOrRejected)} />
          </div>
        )}
        {decisions.due.length > 0 && (
          <div className="mt-2 rounded bg-surface-2 px-2 py-1.5 text-xs text-text">
            {decisions.due.length} follow-up{decisions.due.length === 1 ? '' : 's'} due:{' '}
            {decisions.due
              .slice(0, 3)
              .map((d) => (d.exerciseId ? exerciseName(d.exerciseId) : 'general'))
              .join(', ')}
            {decisions.due.length > 3 ? '…' : ''}
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
