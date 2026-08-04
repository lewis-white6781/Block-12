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
import { round2 } from '../domain/format';
import { axisFormatter, tooltipFormatter } from './chartFormat';
import { convertWeight } from '../domain/units';
import type { WeightUnit } from '../domain/units';
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
  unit: WeightUnit;
}

const BLOCK_DAYS = 84; // 12 weeks

export default function WeightChart({ entries, settings, today, unit }: WeightChartProps) {
  const start = parseISO(settings.blockStartDate);

  // All math here stays kg-native (SPEC-V1.1.md section 3); conversion to the
  // display unit happens once, per point, right before handing data to recharts.
  //
  // Every value is round2'd on the way out. recharts prints whatever number it
  // is given, so an unrounded corridor bound rendered as "76.94642857142858" in
  // the tooltip — SPEC-V3.0.md section 7's 2 dp ceiling applies to chart data,
  // not just to text.
  const display = (kg: number) => round2(convertWeight(kg, unit));

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
      actual: entry?.weightKg !== undefined ? display(entry.weightKg) : undefined,
      rolling: rolling !== null ? display(rolling) : undefined,
      corridorBand: [display(corridorMid - 1), display(corridorMid + 1)] as [number, number],
    };
  });

  const projectedWeight = projectedWeekTwelveWeight(entries, today, settings.blockStartDate);
  const currentRolling = rolling7Weight(entries, today);
  if (projectedWeight !== null && currentRolling !== null) {
    const todayIndex = data.findIndex((d) => d.date === today);
    if (todayIndex >= 0) {
      data[todayIndex].projected = display(currentRolling);
      data[BLOCK_DAYS - 1].projected = display(projectedWeight);
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
          tickFormatter={axisFormatter(1)}
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
          formatter={tooltipFormatter(1, unit)}
        />
        <Area
          dataKey="corridorBand"
          name="Corridor"
          stroke="none"
          fill="var(--good)"
          fillOpacity={0.1}
          isAnimationActive={false}
        />
        <Line
          dataKey="rolling"
          name="7-day avg"
          stroke="var(--good)"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          dataKey="actual"
          name="Weight"
          stroke="none"
          dot={{ r: 4, fill: 'var(--text)', strokeWidth: 0 }}
          isAnimationActive={false}
        />
        <Line
          dataKey="projected"
          name="Projected"
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
