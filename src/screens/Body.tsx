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
import { currentWeek } from '../domain/phase';
import { startOfToday, todayISO } from '../domain/clock';
import { convertWeight } from '../domain/units';
import DailyEntryFields from '../components/DailyEntryFields';
import WeightChart from '../components/WeightChart';
import Stat from '../components/Stat';

const STATUS_COPY: Record<string, string> = {
  onTrack: 'On track',
  tooSlow: 'Slower than planned',
  tooFast: 'Faster than planned — risk to lean mass and skill output',
};

export default function Body() {
  const settings = useStore((s) => s.settings);
  const dailyEntries = useStore((s) => s.dailyEntries);
  const sessionLogs = useStore((s) => s.sessionLogs);

  const todayStr = todayISO();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const entriesArray = useMemo(() => Object.values(dailyEntries), [dailyEntries]);
  const week = currentWeek(startOfToday(), settings.blockStartDate);
  const unit = settings.weightUnit;

  const rolling = rolling7Weight(entriesArray, todayStr);
  const rate = weeklyRateKg(entriesArray, todayStr);
  const status = corridorStatus(rate);
  const projected = projectedWeekTwelveWeight(entriesArray, todayStr, settings.blockStartDate);
  const totalChange = totalChangeFromStart(entriesArray, todayStr, settings.startWeightKg);

  const last7Days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = subDays(startOfToday(), 6 - i);
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
    [dailyEntries],
  );

  const weeks = useMemo(
    () => weeklySummaries(entriesArray, sessionLogs, settings.blockStartDate, week),
    [entriesArray, sessionLogs, settings.blockStartDate, week],
  );

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl text-text">Body</h1>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <label className="mb-2 block text-xs text-muted">
          Date
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="ml-2 min-h-11 rounded border border-line bg-surface-2 px-2 text-text"
          />
        </label>
        <DailyEntryFields date={selectedDate} />
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-text">Weight</span>
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
          <Stat label="7-day avg" value={rolling !== null ? `${convertWeight(rolling, unit).toFixed(1)} ${unit}` : '—'} />
          <Stat
            label="Rate"
            value={rate !== null ? `${rate <= 0 ? '−' : '+'}${Math.abs(convertWeight(rate, unit)).toFixed(2)} ${unit}/wk` : '—'}
          />
          <Stat
            label="Wk 12 projection"
            value={projected !== null ? `${convertWeight(projected, unit).toFixed(1)} ${unit}` : '—'}
            sublabel={
              totalChange !== null
                ? `${totalChange <= 0 ? '−' : '+'}${Math.abs(convertWeight(totalChange, unit)).toFixed(1)} ${unit} so far`
                : undefined
            }
          />
        </div>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">Calories · last 7 days</span>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7Days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
            <YAxis hide domain={[0, 'dataMax + 200']} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--text)' }}
            />
            <Bar dataKey="calories" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">
          Protein · last 7 days <span className="text-muted">(target {settings.proteinTargetLow}–{settings.proteinTargetHigh} g)</span>
        </span>
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
            />
            <ReferenceArea y1={settings.proteinTargetLow} y2={settings.proteinTargetHigh} fill="var(--good)" fillOpacity={0.15} />
            <Bar dataKey="proteinG" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">
          Carbs · last 7 days
          {settings.carbTargetLow !== undefined && settings.carbTargetHigh !== undefined && (
            <span className="text-muted"> (target {settings.carbTargetLow}–{settings.carbTargetHigh} g)</span>
          )}
        </span>
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
            />
            {settings.carbTargetLow !== undefined && settings.carbTargetHigh !== undefined && (
              <ReferenceArea y1={settings.carbTargetLow} y2={settings.carbTargetHigh} fill="var(--good)" fillOpacity={0.15} />
            )}
            <Bar dataKey="carbsG" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">
          Fat · last 7 days
          {settings.fatTargetLow !== undefined && settings.fatTargetHigh !== undefined && (
            <span className="text-muted"> (target {settings.fatTargetLow}–{settings.fatTargetHigh} g)</span>
          )}
        </span>
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
            />
            {settings.fatTargetLow !== undefined && settings.fatTargetHigh !== undefined && (
              <ReferenceArea y1={settings.fatTargetLow} y2={settings.fatTargetHigh} fill="var(--good)" fillOpacity={0.15} />
            )}
            <Bar dataKey="fatG" fill="var(--good)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="mt-4 overflow-x-auto rounded border border-line bg-surface p-3">
        <span className="text-sm text-text">Weekly summary</span>
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
                <td className="py-1 pr-2">
                  {w.meanWeightKg !== null ? convertWeight(w.meanWeightKg, unit).toFixed(1) : '—'}
                </td>
                <td className="py-1 pr-2">
                  {w.changeKg !== null
                    ? `${w.changeKg <= 0 ? '−' : '+'}${Math.abs(convertWeight(w.changeKg, unit)).toFixed(1)}`
                    : '—'}
                </td>
                <td className="py-1 pr-2">{w.ratePct !== null ? `${w.ratePct.toFixed(2)}%` : '—'}</td>
                <td className="py-1 pr-2">{w.meanCalories?.toFixed(0) ?? '—'}</td>
                <td className="py-1 pr-2">{w.meanProteinG?.toFixed(0) ?? '—'}</td>
                <td className="py-1 pr-2">{w.meanCarbsG?.toFixed(0) ?? '—'}</td>
                <td className="py-1 pr-2">{w.meanFatG?.toFixed(0) ?? '—'}</td>
                <td className="py-1">{w.sessionsCompleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
