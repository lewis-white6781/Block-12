// SPEC.md section 7.3 — "Per-exercise chart (picker): toggle between Best set
// score, Total volume, Relative est. 1RM, Difficulty level. Phase bands
// shaded behind the line; deload/taper labelled."
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
import { effectiveLevelForSet } from '../domain/difficulty';
import { phaseForWeek } from '../domain/phase';
import { computeSetScore, est1RMrelative, isQualifyingSet } from '../domain/scoring';
import type { DailyEntry, Exercise, Ladder, Phase, SessionLog, Settings } from '../domain/types';

type MetricKey = 'score' | 'volume' | 'relative1rm' | 'difficulty';

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'score', label: 'Best set score' },
  { key: 'volume', label: 'Total volume' },
  { key: 'relative1rm', label: 'Relative est. 1RM' },
  { key: 'difficulty', label: 'Difficulty level' },
];

interface WeekPoint {
  week: number;
  phase: Phase;
  score?: number;
  volume?: number;
  relative1rm?: number;
  difficulty?: number;
}

interface ProgressChartProps {
  exercise: Exercise;
  ladder: Ladder | undefined;
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

export default function ProgressChart({ exercise, ladder, sessionLogs, dailyEntries, settings }: ProgressChartProps) {
  const [metric, setMetric] = useState<MetricKey>('score');

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
          const score = computeSetScore(exercise, ladder, set, bodyweightKg);
          totalVolume += score;
          if (!isQualifyingSet(set)) continue;

          point.score = point.score === undefined ? score : Math.max(point.score, score);
          const effLevel = effectiveLevelForSet(exercise, ladder, set);
          point.difficulty = point.difficulty === undefined ? effLevel : Math.max(point.difficulty, effLevel);

          if (exercise.metric === 'weightedReps' && set.reps !== undefined) {
            const relative = est1RMrelative(bodyweightKg, set.addedKg ?? 0, set.reps);
            point.relative1rm = point.relative1rm === undefined ? relative : Math.max(point.relative1rm, relative);
          }
        }
      }
      if (any) point.volume = totalVolume;
      return point;
    });
  }, [exercise, ladder, sessionLogs, dailyEntries, settings.startWeightKg]);

  const bands = useMemo(() => phaseBands(data), [data]);
  const hasData = data.some((d) => d[metric] !== undefined);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {METRICS.map((m) => (
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
