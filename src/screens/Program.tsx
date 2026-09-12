// SPEC.md section 7.5 — read-only browser of the whole block: week selector ->
// day -> exercises with every prescription and cue, plus the RPE table, stop
// rules, phase descriptions and the progressive-overload definition. This is
// the reference the plan used to live in a document; it now lives in the app.
import { useMemo, useState } from 'react';
import { program, sessionTitles } from '../data/program';
import { exercisesFor, phaseForWeek, resolvePrescription } from '../domain/phase';
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

// SPEC-V5.0.md section 2 — two RPE tables. Resistance and calisthenics skill
// work share one scale; flexibility has its own, and never needs 8+.
const RPE_TABLES: { id: string; label: string; note: string; rows: { rpe: string; meaning: string }[] }[] = [
  {
    id: 'resistance',
    label: 'Resistance training',
    note: 'For calisthenics skill work, technical failure means the position or movement standard breaks: front lever hips drop, HSPU ROM shortens or the line collapses, a ring dip loses stable depth or lockout. Do not turn prescribed RPE 8 work into RPE 10 work because you feel good.',
    rows: [
      { rpe: '6', meaning: '4+ reps in reserve' },
      { rpe: '7', meaning: '3 reps in reserve' },
      { rpe: '7.5', meaning: '2–3 reps in reserve' },
      { rpe: '8', meaning: '~2 reps in reserve' },
      { rpe: '8.5', meaning: '~1–2 reps in reserve' },
      { rpe: '9', meaning: '~1 rep in reserve' },
      { rpe: '10', meaning: '0 / technical failure' },
    ],
  },
  {
    id: 'flexibility',
    label: 'Flexibility',
    note: 'Progress flexibility through more usable ROM → better control → modest external load, not by tolerating more pain.',
    rows: [
      { rpe: '5', meaning: 'easy' },
      { rpe: '6', meaning: 'clear stretch, fully controlled' },
      { rpe: '7', meaning: 'strong but comfortable' },
      { rpe: '7.5', meaning: 'strong end-range work, still relaxed' },
      { rpe: '8+', meaning: 'not required' },
    ],
  },
];

// SPEC-V5.0.md section 7 — cut-specific autoregulation. Reduce load or volume
// that day if any of these hold; never compensate for poor recovery by training
// to failure, adding unscheduled sets, racing the Sunday cardio, or testing
// HSPU / front lever every week.
const AUTOREGULATION_RULES: string[] = [
  'The first work set is ~1 RPE above prescription.',
  'Performance falls more than 10–15% across sets.',
  'Multiple nights of poor sleep have accumulated.',
  'Joints or tendons are becoming progressively irritated.',
  'Bodyweight is dropping much faster than intended and strength is falling.',
];

// SPEC-V5.0.md section 7's joint/tendon rule — remove the movement, do not
// "RPE through" it.
const TENDON_RULES: string[] = [
  'sharp pain',
  'tendon pain that increases through the warm-up',
  'sudden loss of strength',
  'persistent elbow, shoulder or Achilles irritation',
  'pain that changes how you move',
];

// SPEC-V5.0.md section 8 — what counts as progress during a cut.
const PROGRESSIVE_OVERLOAD_AXES: string[] = [
  'same weighted dip at lower bodyweight',
  'same weighted pull-up at lower bodyweight',
  'harder HSPU leverage',
  'greater HSPU ROM',
  'less wall assistance',
  'harder front-lever progression',
  'less band assistance',
  'better lever body line',
  'stronger dragon flag / rollout / wiper',
  'deeper pancake / splits / pike',
  'greater cardio output at the same RPE',
];

function ExerciseEntry({ exercise, week }: { exercise: Exercise; week: number }) {
  const prescription = resolvePrescription(exercise, week);
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-text">
          {exercise.order} {exercise.name}
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

  // All three slots, each hidden when the day has nothing in it — Thursday runs
  // and does nothing else, and the Wednesday recovery run is absent in weeks
  // 1, 2 and 4.
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

        {blocks.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-muted">Nothing prescribed this day in week {week}.</p>
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

        <Card className="mt-4">
          <SectionHeader>Autoregulation</SectionHeader>
          <p className="mt-1 text-xs text-muted">
            The plan provides the target. Your readiness determines the exact load.
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text">
            {AUTOREGULATION_RULES.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </Card>

        <Card className="mt-4">
          <SectionHeader>Joint & tendon rule</SectionHeader>
          <p className="mt-1 text-xs text-muted">
            Immediately reduce or remove the high-strain movement if you get:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text">
            {TENDON_RULES.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-bad">Do not attempt to "RPE through" tendon pain.</p>
        </Card>

        <Card className="mt-4">
          <SectionHeader>Progress during the cut</SectionHeader>
          <p className="mt-1 text-xs text-muted">
            The block does not require muscle gain to succeed. Progressive overload may appear as:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text">
            {PROGRESSIVE_OVERLOAD_AXES.map((axis, i) => (
              <li key={i}>{axis}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
