// SPEC.md section 7.4 — weight chart: daily dots + 7-day rolling line + shaded
// target corridor (77 -> 72.5 kg, ±1 kg band) + dashed projected finish line.
import { addDays, format, parseISO } from 'date-fns';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { projectedWeekTwelveWeight, rolling7Weight } from '../domain/body';
import type { DailyEntry, Settings } from '../domain/types';

interface ChartPoint {
  date: string;
  actual?: number;
  rolling?: number;
  corridorBand: [number, number];
  projected?: number;
}

interface WeightChartProps {
  entries: DailyEntry[];
  settings: Settings;
  today: string;
}

const BLOCK_DAYS = 84; // 12 weeks

export default function WeightChart({ entries, settings, today }: WeightChartProps) {
  const start = parseISO(settings.blockStartDate);

  const data: ChartPoint[] = Array.from({ length: BLOCK_DAYS }, (_, i) => {
    const date = format(addDays(start, i), 'yyyy-MM-dd');
    const t = i / (BLOCK_DAYS - 1);
    const corridorMid = settings.startWeightKg + (settings.targetWeightKg - settings.startWeightKg) * t;
    const entry = entries.find((e) => e.date === date);
    // rolling7Weight legitimately holds the last known average forward for dates
    // past the last entry (per its "last 7 available" contract) — correct for
    // querying, but the chart must not draw that plateau as real trend past today.
    const rolling = date <= today ? rolling7Weight(entries, date) : null;
    return {
      date,
      actual: entry?.weightKg,
      rolling: rolling ?? undefined,
      corridorBand: [corridorMid - 1, corridorMid + 1],
    };
  });

  const projectedWeight = projectedWeekTwelveWeight(entries, today, settings.blockStartDate);
  const currentRolling = rolling7Weight(entries, today);
  if (projectedWeight !== null && currentRolling !== null) {
    const todayIndex = data.findIndex((d) => d.date === today);
    if (todayIndex >= 0) {
      data[todayIndex].projected = currentRolling;
      data[BLOCK_DAYS - 1].projected = projectedWeight;
    }
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => format(parseISO(d), 'MMM d')}
          interval={13}
          tick={{ fill: 'var(--muted)', fontSize: 10 }}
          axisLine={{ stroke: 'var(--line)' }}
          tickLine={false}
        />
        <YAxis
          domain={['dataMin - 1', 'dataMax + 1']}
          tick={{ fill: 'var(--muted)', fontSize: 10 }}
          axisLine={{ stroke: 'var(--line)' }}
          tickLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            fontSize: 12,
            color: 'var(--text)',
          }}
          labelFormatter={(d) => format(parseISO(d as string), 'EEE d MMM')}
        />
        <Area
          dataKey="corridorBand"
          stroke="none"
          fill="var(--good)"
          fillOpacity={0.1}
          isAnimationActive={false}
        />
        <Line
          dataKey="rolling"
          stroke="var(--good)"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          dataKey="actual"
          stroke="none"
          dot={{ r: 4, fill: 'var(--text)', strokeWidth: 0 }}
          isAnimationActive={false}
        />
        <Line
          dataKey="projected"
          stroke="var(--muted)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
