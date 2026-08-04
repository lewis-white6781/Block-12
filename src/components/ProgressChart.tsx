// Per-exercise chart — SPEC.md section 7.3 as amended by SPEC-V3.0.md section 2.
//
// v3.0 dropped the "Difficulty level" and abstract "Best set score" series.
// "Best set" is now the raw logged number in the movement's own unit, and
// volume is the plain sum of that number across the week. Phase bands behind
// the line are unchanged; deload/taper stay labelled.
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { rolling7Weight } from '../domain/body';
import { axisFormatter, tooltipFormatter } from './chartFormat';
import { bestKindFor, plainScore } from '../domain/performance';
import { phaseForWeek } from '../domain/phase';
import { est1RMrelative, isQualifyingSet } from '../domain/scoring';
import type { DailyEntry, Exercise, Phase, SessionLog, Settings } from '../domain/types';

type MetricKey = 'best' | 'volume' | 'relative1rm';

const UNIT_LABEL: Record<ReturnType<typeof bestKindFor>, string> = {
  reps: 'reps',
  weightedReps: 'reps',
  seconds: 's',
  distance: 'm',
};

interface WeekPoint {
  week: number;
  phase: Phase;
  best?: number;
  volume?: number;
  relative1rm?: number;
}

interface ProgressChartProps {
  exercise: Exercise;
  sessionLogs: Record<string, SessionLog>;
  dailyEntries: DailyEntry[];
  settings: Settings;
}

function phaseBands(data: WeekPoint[]): { phase: Phase; x1: number; x2: number }[] {
  const bands: { phase: Phase; x1: number; x2: number }[] = [];
  for (const point of data) {
    const last = bands[bands.length - 1];
    if (last && last.phase === point.phase) {
      last.x2 = point.week;
    } else {
      bands.push({ phase: point.phase, x1: point.week, x2: point.week });
    }
  }
  return bands;
}

export default function ProgressChart({ exercise, sessionLogs, dailyEntries, settings }: ProgressChartProps) {
  const [metric, setMetric] = useState<MetricKey>('best');

  const unit = UNIT_LABEL[bestKindFor(exercise.metric)];
  const metrics: { key: MetricKey; label: string }[] = [
    { key: 'best', label: `Best set (${unit})` },
    { key: 'volume', label: `Total volume (${unit})` },
    // Only meaningful where there is a load to be relative to.
    ...(exercise.metric === 'weightedReps'
      ? [{ key: 'relative1rm' as const, label: 'Relative est. 1RM' }]
      : []),
  ];

  const data = useMemo<WeekPoint[]>(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const week = i + 1;
      const point: WeekPoint = { week, phase: phaseForWeek(week) };
      let any = false;
      let totalVolume = 0;

      for (const session of Object.values(sessionLogs)) {
        if (session.week !== week) continue;
        const log = session.exercises.find((e) => e.exerciseId === exercise.id);
        if (!log) continue;
        const bodyweightKg = rolling7Weight(dailyEntries, session.date) ?? settings.startWeightKg;

        for (const set of log.sets) {
          any = true;
          const value = plainScore(exercise.metric, set);
          totalVolume += value;
          if (!isQualifyingSet(set)) continue;

          point.best = point.best === undefined ? value : Math.max(point.best, value);

          if (exercise.metric === 'weightedReps' && set.reps !== undefined) {
            const relative = est1RMrelative(bodyweightKg, set.addedKg ?? 0, set.reps);
            point.relative1rm = point.relative1rm === undefined ? relative : Math.max(point.relative1rm, relative);
          }
        }
      }
      if (any) point.volume = totalVolume;
      return point;
    });
  }, [exercise, sessionLogs, dailyEntries, settings.startWeightKg]);

  const bands = useMemo(() => phaseBands(data), [data]);
  const hasData = data.some((d) => d[metric] !== undefined);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={`min-h-11 shrink-0 rounded-full border px-3 text-xs ${
              metric === m.key ? 'border-text bg-surface-2 text-text' : 'border-line text-muted'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <p className="mt-3 text-xs text-muted">No sets yet. Log your first set to see a comparison.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            {bands.map((b) => (
              <ReferenceArea
                key={`${b.phase}-${b.x1}`}
                x1={b.x1}
                x2={b.x2}
                fill={`var(--${b.phase})`}
                fillOpacity={b.phase === 'deload' || b.phase === 'taper' ? 0.16 : 0.06}
                ifOverflow="visible"
                label={
                  b.phase === 'deload' || b.phase === 'taper'
                    ? { value: b.phase, position: 'insideTop', fill: 'var(--muted)', fontSize: 10 }
                    : undefined
                }
              />
            ))}
            <XAxis
              dataKey="week"
              type="number"
              domain={[1, 12]}
              ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={axisFormatter(1)}
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
              width={32}
              domain={['dataMin', 'dataMax']}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                fontSize: 12,
                color: 'var(--text)',
              }}
              labelFormatter={(w) => `Week ${w}`}
              formatter={tooltipFormatter(2)}
            />
            <Line
              dataKey={metric}
              stroke="var(--good)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--good)', strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
