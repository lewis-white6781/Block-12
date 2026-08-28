// SPEC.md section 7.5 — read-only browser of the whole block: week selector ->
// day -> exercises with every prescription and cue, plus the RPE table, stop
// rules, phase descriptions and the progressive-overload definition. This is
// the reference the plan used to live in a document; it now lives in the app.
import { useMemo, useState } from 'react';
import { program, sessionTitles } from '../data/program';
import { exercisesFor, phaseForWeek, resolvePrescription, waveForWeek } from '../domain/phase';
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

// SPEC-V4.0.md section 1 — three RPE tables, because the block trains three
// kinds of work and they do not share a scale.
const RPE_TABLES: { id: string; label: string; note: string; rows: { rpe: string; meaning: string }[] }[] = [
  {
    id: 'dynamic',
    label: 'Dynamic strength',
    note: 'RPE 8 means you finish knowing you could do about two more perfect reps. Technical breakdown counts as failure — do not count ugly repetitions.',
    rows: [
      { rpe: '5', meaning: '5+ reps in reserve' },
      { rpe: '6', meaning: '4 reps in reserve' },
      { rpe: '7', meaning: '3 reps in reserve' },
      { rpe: '8', meaning: '2 reps in reserve' },
      { rpe: '8.5', meaning: '1–2 reps in reserve' },
      { rpe: '9', meaning: '1 rep in reserve' },
      { rpe: '10', meaning: '0 / technical failure' },
    ],
  },
  {
    id: 'isometric',
    label: 'Isometric holds',
    note: 'Read as clean seconds remaining. A front lever hold ends when the position deteriorates — not when gravity finally wins.',
    rows: [
      { rpe: '5', meaning: '6+ s remaining' },
      { rpe: '6', meaning: '5 s remaining' },
      { rpe: '7', meaning: '3–4 s remaining' },
      { rpe: '8', meaning: '~2 s remaining' },
      { rpe: '8.5', meaning: '~1–2 s remaining' },
      { rpe: '9', meaning: '~1 s remaining' },
      { rpe: '10', meaning: 'position failure' },
    ],
  },
  {
    id: 'flexibility',
    label: 'Flexibility',
    note: 'For this block, flexibility work should almost always stay at RPE 6–7. RPE 9–10 is not used.',
    rows: [
      { rpe: '5', meaning: 'easy' },
      { rpe: '6', meaning: 'clear stretch, fully controlled' },
      { rpe: '7', meaning: 'strong stretch, still controlled' },
      { rpe: '8', meaning: 'very strong, but no pain' },
      { rpe: '9–10', meaning: 'not used' },
    ],
  },
];

// SPEC-V4.0.md section 7 — the autoregulation rules that override the sheet.
const AUTOREGULATION_RULES: string[] = [
  'If the first two sets feel a full point above target, cut load, leverage, ROM or skill difficulty by 5–10%.',
  'If performance falls more than ~15% from the first working set, drop the last set, reduce load, or regress the skill.',
  'Never turn a planned RPE 8 day into an accidental RPE 10 session.',
];

// SPEC-V4.0.md section 7's joint/tendon rule — remove the movement, do not
// "RPE through" it.
const TENDON_RULES: string[] = [
  'sharp pain',
  'tendon pain that increases through the warm-up',
  'sudden loss of strength',
  'persistent elbow, shoulder or Achilles irritation',
  'pain that changes how you move',
];

// SPEC-V4.0.md section 8 — what progress is allowed to look like during a cut.
const PROGRESSIVE_OVERLOAD_AXES: string[] = [
  'more weight',
  'more ROM',
  'harder leverage',
  'less band assistance',
  'better balance',
  'better body line',
  'same absolute strength at lower bodyweight',
  'better running pace at the same RPE',
  'improved flexibility',
  'better technical consistency',
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
  const wave = waveForWeek(week);

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
      <PhaseBadge week={week} phase={phase} dateLabel={`Wave ${wave}`} />

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
            Wave {wave} — {phase}
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
