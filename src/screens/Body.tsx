// SPEC.md section 7.4.
import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/useStore';
import {
  corridorStatus,
  corridorTargetMismatch,
  planVarianceKg,
  plannedWeightOnDate,
  projectedWeekTwelveWeight,
  rolling7Weight,
  totalChangeFromStart,
  weeklyRateKg,
  weeklySummaries,
} from '../domain/body';
import { BLOCK_DAYS, currentWeek, dateForBlockDay, phaseForWeek } from '../domain/phase';
import { useToday } from '../hooks/useToday';
import { fmt, fmtPct } from '../domain/format';
import { tooltipFormatter } from '../components/chartFormat';
import { fmtKg, fmtKgSigned } from '../domain/units';
import DailyEntryFields from '../components/DailyEntryFields';
import NutritionCheckBanner from '../components/NutritionCheckBanner';
import { nutritionRules } from '../data/nutrition';
import { dailyTargets } from '../domain/nutrition';
import WeightChart from '../components/WeightChart';
import Stat from '../components/Stat';
import PhaseBadge from '../components/PhaseBadge';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';

const STATUS_COPY: Record<string, string> = {
  onTrack: 'On track',
  tooSlow: 'Slower than planned',
  tooFast: 'Faster than planned — risk to lean mass and skill output',
};

export default function Body() {
  const settings = useStore((s) => s.settings);
  const dailyEntries = useStore((s) => s.dailyEntries);
  const sessionLogs = useStore((s) => s.sessionLogs);
  const undoLastNutritionAdjustment = useStore((s) => s.undoLastNutritionAdjustment);

  const today = useToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const entriesArray = useMemo(() => Object.values(dailyEntries), [dailyEntries]);
  const week = currentWeek(today, settings.blockStartDate);

  // v3.0 (SPEC-V3.0.md section 4): clamped to the block, not to "today". Every
  // day of the block is editable, including ones still ahead.
  const blockFirstDay = settings.blockStartDate;
  const blockLastDay = format(dateForBlockDay(settings.blockStartDate, BLOCK_DAYS - 1), 'yyyy-MM-dd');
  const unit = settings.weightUnit;

  const rolling = rolling7Weight(entriesArray, todayStr);
  const rate = weeklyRateKg(entriesArray, todayStr);
  const status = corridorStatus(rate);
  const projected = projectedWeekTwelveWeight(entriesArray, todayStr, settings.blockStartDate);
  const totalChange = totalChangeFromStart(entriesArray, todayStr, settings.startWeightKg);
  // v5.1 metric audit: progress against the chosen 80 -> 73 trajectory, kept
  // separate from the rate corridor — they answer different questions.
  const planVariance = planVarianceKg(entriesArray, todayStr, settings);
  const plannedToday = plannedWeightOnDate(settings, todayStr);
  const targetMismatch = corridorTargetMismatch(settings);
  const targets = dailyTargets(entriesArray, settings, todayStr);
  const adjustments = settings.nutritionAdjustments ?? [];

  const last7Days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = subDays(today, 6 - i);
        const date = format(d, 'yyyy-MM-dd');
        const entry = dailyEntries[date];
        return {
          date,
          label: format(d, 'EEE'),
          calories: entry?.calories,
          proteinG: entry?.proteinG,
          carbsG: entry?.carbsG,
          fatG: entry?.fatG,
        };
      }),
    [dailyEntries, today],
  );

  const weeks = useMemo(
    () => weeklySummaries(entriesArray, sessionLogs, settings.blockStartDate, week),
    [entriesArray, sessionLogs, settings.blockStartDate, week],
  );

  return (
    <div className="flex h-full flex-col">
      <PhaseBadge week={week} phase={phaseForWeek(week)} dateLabel={format(today, 'EEE d MMM')} />

      <div className="flex-1 overflow-y-auto p-4">
        <h1 className="font-display text-2xl text-text">Body</h1>

      <Card className="mt-4">
        <label className="mb-2 block text-xs text-muted">
          Date
          <input
            type="date"
            value={selectedDate}
            min={blockFirstDay}
            max={blockLastDay}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="ml-2 min-h-11 rounded border border-line bg-surface-2 px-2 text-text"
          />
        </label>
        <DailyEntryFields date={selectedDate} />
      </Card>

      <Card className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader>Weight</SectionHeader>
          {status && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                status === 'onTrack' ? 'bg-good text-bg' : status === 'tooFast' ? 'bg-bad text-bg' : 'bg-warn text-bg'
              }`}
            >
              {STATUS_COPY[status]}
            </span>
          )}
        </div>
        <WeightChart entries={entriesArray} settings={settings} today={todayStr} unit={unit} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="7-day avg" value={rolling !== null ? `${fmtKg(rolling, unit)} ${unit}` : '—'} />
          <Stat
            label="Rate"
            value={rate !== null ? `${fmtKgSigned(rate, unit)} ${unit}/wk` : '—'}
          />
          <Stat
            label="Wk 12 projection"
            value={projected !== null ? `${fmtKg(projected, unit)} ${unit}` : '—'}
            sublabel={totalChange !== null ? `${fmtKgSigned(totalChange, unit, 1)} ${unit} so far` : undefined}
          />
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <Stat
            label="vs plan"
            value={planVariance !== null ? `${fmtKgSigned(planVariance, unit)} ${unit}` : '—'}
            sublabel={`Straight-line ${fmtKg(settings.startWeightKg, unit)} → ${fmtKg(settings.targetWeightKg, unit)} ${unit} says ${fmtKg(plannedToday, unit)} ${unit} today`}
          />
          {planVariance !== null && (
            <p className="mt-1 text-xs text-muted">
              {planVariance > 0 ? 'Behind' : 'Ahead of'} the target trajectory. The rate badge above
              judges the current weekly rate, not this.
            </p>
          )}
        </div>
        {targetMismatch && (
          <div className="mt-3 rounded bg-warn px-3 py-2 text-xs text-bg">{targetMismatch}</div>
        )}
      </Card>

      <Card className="mt-4">
        <SectionHeader>Nutrition · today's targets</SectionHeader>
        <p className="mt-0.5 text-xs text-muted">
          {targets.row.label} row, from{' '}
          {targets.basis === 'avg7'
            ? `the 7-day average ${fmtKg(targets.basisKg, unit)} ${unit}`
            : targets.basis === 'latest'
              ? `the last weigh-in ${fmtKg(targets.basisKg, unit)} ${unit}`
              : `the start weight ${fmtKg(targets.basisKg, unit)} ${unit}`}
          {targets.belowTable && ' — below the table, bottom row held'}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat
            label="Calories"
            value={fmt(targets.kcal, 0)}
            sublabel={
              targets.adjustmentKcal !== 0
                ? `table ${fmt(targets.row.kcal, 0)} ${targets.adjustmentKcal > 0 ? '+' : '−'} ${fmt(Math.abs(targets.adjustmentKcal), 0)}`
                : 'kcal'
            }
          />
          <Stat label="Protein" value={`${fmt(targets.proteinG, 0)} g`} sublabel="hit it first" />
          <Stat label="Fat" value={`${fmt(targets.fatG, 0)} g`} />
          <Stat label="Carbs" value={`${fmt(targets.carbsG, 0)} g`} />
        </div>
        <div className="mt-3">
          <NutritionCheckBanner date={todayStr} isToday />
        </div>
        {adjustments.length > 0 && (
          <div className="mt-3 border-t border-line pt-2">
            <div className="text-xs uppercase tracking-wide text-muted">Adjustments applied</div>
            <ul className="mt-1 space-y-0.5 text-sm tabular-nums text-text">
              {adjustments.map((a, i) => (
                <li key={`${a.date}-${i}`}>
                  {a.date}: {a.kcal > 0 ? '+' : '−'}
                  {fmt(Math.abs(a.kcal), 0)} kcal ({a.kcal > 0 ? '+' : '−'}
                  {fmt(Math.abs(a.kcal) / 4, 0)} g carbs)
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={undoLastNutritionAdjustment}
              className="mt-2 min-h-11 w-full rounded border border-line text-sm text-text"
            >
              Undo last adjustment
            </button>
          </div>
        )}
        <details className="mt-3 text-xs text-muted">
          <summary className="min-h-11 py-3">The plan's nutrition rules</summary>
          <ol className="list-decimal space-y-0.5 pl-5">
            {nutritionRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </details>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Calories · last 7 days</SectionHeader>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
            <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, targets.kcal) + 200]} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
              formatter={tooltipFormatter(0)}
            />
            <ReferenceLine y={targets.kcal} stroke="var(--muted)" strokeDasharray="4 4" />
            <Bar dataKey="calories" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Protein · last 7 days</SectionHeader>
        <p className="mt-0.5 text-xs text-muted">Target {fmt(targets.proteinG, 0)} g</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
            <YAxis
              domain={[0, (dataMax: number) => Math.max(dataMax, targets.proteinG) + 40]}
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
              formatter={tooltipFormatter(0)}
            />
            <ReferenceLine y={targets.proteinG} stroke="var(--muted)" strokeDasharray="4 4" />
            <Bar dataKey="proteinG" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Carbs · last 7 days</SectionHeader>
        <p className="mt-0.5 text-xs text-muted">Target {fmt(targets.carbsG, 0)} g</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
            <YAxis
              domain={[0, (dataMax: number) => Math.max(dataMax, targets.carbsG) + 40]}
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
              formatter={tooltipFormatter(0)}
            />
            <ReferenceLine y={targets.carbsG} stroke="var(--muted)" strokeDasharray="4 4" />
            <Bar dataKey="carbsG" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Fat · last 7 days</SectionHeader>
        <p className="mt-0.5 text-xs text-muted">Target {fmt(targets.fatG, 0)} g</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
            <YAxis
              domain={[0, (dataMax: number) => Math.max(dataMax, targets.fatG) + 20]}
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
              formatter={tooltipFormatter(0)}
            />
            <ReferenceLine y={targets.fatG} stroke="var(--muted)" strokeDasharray="4 4" />
            <Bar dataKey="fatG" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="mt-4 overflow-x-auto">
        <SectionHeader>Weekly summary</SectionHeader>
        <table className="mt-2 w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="text-muted">
              <th className="py-1 pr-2">Wk</th>
              <th className="py-1 pr-2">Mean {unit}</th>
              <th className="py-1 pr-2">Change</th>
              <th className="py-1 pr-2">Rate %</th>
              <th className="py-1 pr-2">Mean kcal</th>
              <th className="py-1 pr-2">Mean protein</th>
              <th className="py-1 pr-2">Mean carbs</th>
              <th className="py-1 pr-2">Mean fat</th>
              <th className="py-1">Sessions</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-text">
            {weeks.map((w) => (
              <tr key={w.week} className="border-t border-line">
                <td className="py-1 pr-2">{w.week}</td>
                <td className="py-1 pr-2">{w.meanWeightKg !== null ? fmtKg(w.meanWeightKg, unit) : '—'}</td>
                <td className="py-1 pr-2">
                  {w.changeKg !== null ? fmtKgSigned(w.changeKg, unit, 1) : '—'}
                </td>
                <td className="py-1 pr-2">{w.ratePct !== null ? fmtPct(w.ratePct) : '—'}</td>
                <td className="py-1 pr-2">{w.meanCalories !== null ? fmt(w.meanCalories, 0) : '—'}</td>
                <td className="py-1 pr-2">{w.meanProteinG !== null ? fmt(w.meanProteinG, 0) : '—'}</td>
                <td className="py-1 pr-2">{w.meanCarbsG !== null ? fmt(w.meanCarbsG, 0) : '—'}</td>
                <td className="py-1 pr-2">{w.meanFatG !== null ? fmt(w.meanFatG, 0) : '—'}</td>
                <td className="py-1">{w.sessionsCompleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      </div>
    </div>
  );
}
