// SPEC.md section 7.4.
import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/useStore';
import {
  corridorStatus,
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
      </Card>

      <Card className="mt-4">
        <SectionHeader>Calories · last 7 days</SectionHeader>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
            <YAxis hide domain={[0, 'dataMax + 200']} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
              formatter={tooltipFormatter(0)}
            />
            <Bar dataKey="calories" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Protein · last 7 days</SectionHeader>
        <p className="mt-0.5 text-xs text-muted">
          Target {settings.proteinTargetLow}–{settings.proteinTargetHigh} g
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
            <YAxis
              domain={[0, 'dataMax + 40']}
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
              formatter={tooltipFormatter(0)}
            />
            <ReferenceArea y1={settings.proteinTargetLow} y2={settings.proteinTargetHigh} fill="var(--good)" fillOpacity={0.15} />
            <Bar dataKey="proteinG" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Carbs · last 7 days</SectionHeader>
        {settings.carbTargetLow !== undefined && settings.carbTargetHigh !== undefined && (
          <p className="mt-0.5 text-xs text-muted">
            Target {settings.carbTargetLow}–{settings.carbTargetHigh} g
          </p>
        )}
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
            <YAxis
              domain={[0, 'dataMax + 40']}
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
              formatter={tooltipFormatter(0)}
            />
            {settings.carbTargetLow !== undefined && settings.carbTargetHigh !== undefined && (
              <ReferenceArea y1={settings.carbTargetLow} y2={settings.carbTargetHigh} fill="var(--good)" fillOpacity={0.15} />
            )}
            <Bar dataKey="carbsG" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="mt-4">
        <SectionHeader>Fat · last 7 days</SectionHeader>
        {settings.fatTargetLow !== undefined && settings.fatTargetHigh !== undefined && (
          <p className="mt-0.5 text-xs text-muted">
            Target {settings.fatTargetLow}–{settings.fatTargetHigh} g
          </p>
        )}
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
            <YAxis
              domain={[0, 'dataMax + 20']}
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
              formatter={tooltipFormatter(0)}
            />
            {settings.fatTargetLow !== undefined && settings.fatTargetHigh !== undefined && (
              <ReferenceArea y1={settings.fatTargetLow} y2={settings.fatTargetHigh} fill="var(--good)" fillOpacity={0.15} />
            )}
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
