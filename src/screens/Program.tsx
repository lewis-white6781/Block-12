// SPEC.md section 7.5 — read-only browser of the whole block: week selector ->
// day -> exercises with every prescription and cue, plus the RPE table, stop
// rules, phase descriptions and the progressive-overload definition. This is
// the reference the plan used to live in a document; it now lives in the app.
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { dailyChecksFor, phaseTable, planRules, program, sessionTitles } from '../data/program';
import { useStore } from '../store/useStore';
import { dateForBlockDay, exercisesFor, phaseForWeek, resolvePrescription } from '../domain/phase';
import { PHASE_NOTES } from '../domain/review';
import type { Block, DayId, Exercise } from '../domain/types';
import PhaseBadge from '../components/PhaseBadge';
import { formatPrescription } from '../components/ExerciseCard';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import PagerNav from '../components/PagerNav';

const DAY_ORDER: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABEL: Record<DayId, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const BLOCK_ORDER: Block[] = ['am', 'main', 'later'];

// Two RPE scales the Cut to New Year block uses: strength for everything
// loaded, stretch for Mobility + Core's stretches ("Stretch intensity RPE
// 6–7.5"). Definitions only — the prescriptions live in program.ts.
const RPE_TABLES: { id: string; label: string; note: string; rows: { rpe: string; meaning: string }[] }[] = [
  {
    id: 'resistance',
    label: 'Resistance training',
    note: 'For skill work, technical failure means the movement standard breaks: front lever hips drop, HSPU ROM shortens or the line collapses, a ring dip loses depth or lockout.',
    rows: [
      { rpe: '6', meaning: '4+ reps in reserve' },
      { rpe: '7', meaning: '3 reps in reserve' },
      { rpe: '7.5', meaning: '2–3 reps in reserve' },
      { rpe: '8', meaning: '~2 reps in reserve' },
      { rpe: '8.5', meaning: '~1–2 reps in reserve' },
      { rpe: '9', meaning: '~1 rep in reserve' },
      { rpe: '9.5', meaning: 'maybe 1 rep in reserve' },
      { rpe: '10', meaning: '0 / technical failure' },
    ],
  },
  {
    id: 'flexibility',
    label: 'Stretching',
    note: 'Mobility + Core stretches sit at RPE 6–7.5.',
    rows: [
      { rpe: '6', meaning: 'clear stretch, fully controlled' },
      { rpe: '7', meaning: 'strong but comfortable' },
      { rpe: '7.5', meaning: 'strong end-range work, still relaxed' },
    ],
  },
];

function ExerciseEntry({ exercise, week }: { exercise: Exercise; week: number }) {
  const prescription = resolvePrescription(exercise, week);
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-text">
          {exercise.order || '—'} {exercise.name}
        </span>
        <span className="shrink-0 tabular-nums text-muted">{formatPrescription(prescription)}</span>
      </div>
      {exercise.cues.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
          {exercise.cues.map((cue, i) => (
            <li key={i}>{cue}</li>
          ))}
        </ul>
      )}
      {exercise.stopRules.length > 0 && (
        <p className="mt-1 text-xs text-bad">Stop: {exercise.stopRules.join(' · ')}</p>
      )}
    </div>
  );
}

export default function Program() {
  const [week, setWeek] = useState(1);
  const [dayId, setDayId] = useState<DayId>('mon');
  const phase = phaseForWeek(week);
  const blockStartDate = useStore((s) => s.settings.blockStartDate);

  /** "11 Oct – 24 Oct" for a run of weeks, from the block's actual start date. */
  function weeksDateRange(weeks: number[]): string {
    const first = dateForBlockDay(blockStartDate, (weeks[0] - 1) * 7);
    const last = dateForBlockDay(blockStartDate, weeks[weeks.length - 1] * 7 - 1);
    return `${format(first, 'd MMM')} – ${format(last, 'd MMM')}`;
  }

  // Every slot, each hidden when the day has nothing in it — Tuesday, Wednesday
  // and Friday carry no gym session, and the Christmas weeks drop everything
  // outside the floor.
  const blocks = useMemo(
    () =>
      BLOCK_ORDER.map((block) => ({
        block,
        title: sessionTitles[dayId][block],
        exercises: exercisesFor(program, dayId, block, week),
      })).filter((b) => b.exercises.length > 0),
    [dayId, week],
  );

  return (
    <div className="flex h-full flex-col">
      <PhaseBadge week={week} phase={phase} dateLabel="Program" />

      <div className="flex-1 overflow-y-auto p-4 text-text">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-text">Program</h1>
          <PagerNav
            onPrev={() => setWeek((w) => w - 1)}
            onNext={() => setWeek((w) => w + 1)}
            disablePrev={week <= 1}
            disableNext={week >= 12}
            center={<span className="tabular-nums text-sm text-muted">Week {week}</span>}
          />
        </div>

        <div className="mt-3 flex gap-1">
          {DAY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDayId(d)}
              className={`min-h-11 flex-1 rounded text-xs uppercase tracking-wide ${
                d === dayId ? 'bg-surface-2 text-text' : 'text-muted'
              }`}
            >
              {DAY_LABEL[d]}
            </button>
          ))}
        </div>

        <Card className="mt-4">
          <SectionHeader>Daily</SectionHeader>
          <ul className="mt-1 space-y-0.5 text-sm text-text">
            {dailyChecksFor(dayId).map((check) => (
              <li key={check.id}>
                ☐ {check.label}
                {check.detail && <span className="text-xs text-muted"> — {check.detail}</span>}
              </li>
            ))}
          </ul>
        </Card>

        {blocks.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-muted">No gym session this day.</p>
          </Card>
        ) : (
          blocks.map(({ block, title, exercises }) => (
            <Card key={block} className="mt-4">
              <SectionHeader>{block === 'later' ? 'Later' : block === 'am' ? 'AM' : 'Main'}</SectionHeader>
              <h2 className="mt-1 font-display text-base text-text">{title}</h2>
              <div className="mt-2 divide-y divide-line">
                {exercises.map((exercise) => (
                  <ExerciseEntry key={exercise.id} exercise={exercise} week={week} />
                ))}
              </div>
            </Card>
          ))
        )}

        <Card className="mt-4">
          <SectionHeader>
            Week {week} — {phase}
          </SectionHeader>
          <p className="mt-2 text-sm text-text">{PHASE_NOTES[phase]}</p>
        </Card>

        {RPE_TABLES.map((table) => (
          <Card key={table.id} className="mt-4">
            <SectionHeader>RPE — {table.label}</SectionHeader>
            <table className="mt-2 w-full text-left text-xs">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 pr-2">RPE</th>
                  <th className="py-1">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {table.rows.map((r) => (
                  <tr key={r.rpe} className="border-t border-line">
                    <td className="py-1 pr-2 tabular-nums">{r.rpe}</td>
                    <td className="py-1">{r.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">{table.note}</p>
          </Card>
        ))}

        <Card className="mt-4 overflow-x-auto">
          <SectionHeader>Sets by phase</SectionHeader>
          <table className="mt-2 w-full text-left text-xs">
            <thead>
              <tr className="text-muted">
                <th className="py-1 pr-2">Phase</th>
                <th className="py-1 pr-2">Weeks</th>
                <th className="py-1 pr-2">Dates</th>
                <th className="py-1 pr-2">★ sets</th>
                <th className="py-1">RPE</th>
              </tr>
            </thead>
            <tbody className="text-text">
              {phaseTable.map((row) => (
                <tr
                  key={row.phase}
                  className={`border-t border-line ${row.weeks.includes(week) ? 'bg-surface-2' : ''}`}
                >
                  <td className="py-1 pr-2">{row.phase}</td>
                  <td className="py-1 pr-2 tabular-nums">
                    {row.weeks.length > 1 ? `${row.weeks[0]}–${row.weeks[row.weeks.length - 1]}` : row.weeks[0]}
                  </td>
                  <td className="py-1 pr-2 tabular-nums">{weeksDateRange(row.weeks)}</td>
                  <td className="py-1 pr-2 tabular-nums">{row.starSets}</td>
                  <td className="py-1 tabular-nums">{row.rpe}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
            {planRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
