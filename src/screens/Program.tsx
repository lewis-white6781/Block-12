// SPEC.md section 7.5 — read-only browser of the whole block: week selector ->
// day -> exercises with every prescription and cue, plus the RPE table, stop
// rules, phase descriptions and the progressive-overload definition. This is
// the reference the plan used to live in a document; it now lives in the app.
import { useMemo, useState } from 'react';
import { dayTitles, program } from '../data/program';
import { exercisesFor, phaseForWeek, resolvePrescription } from '../domain/phase';
import { PHASE_NOTES } from '../domain/review';
import type { DayId, Exercise } from '../domain/types';
import PhaseBadge from '../components/PhaseBadge';
import { formatPrescription } from '../components/ExerciseCard';

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

// Appendix A (SPEC.md, "render in-app on the RPE stepper") — reproduced here
// too, per section 7.5's requirement that Program include the RPE table.
const RPE_REFERENCE: { rpe: number; reserve: string }[] = [
  { rpe: 6, reserve: 'at least 4 clean reps or 5+ hold seconds left' },
  { rpe: 7, reserve: 'about 3 reps or 4 hold seconds left' },
  { rpe: 8, reserve: 'about 2 reps or 2–3 hold seconds left' },
  { rpe: 9, reserve: 'about 1 rep or 1 hold second left' },
  { rpe: 10, reserve: 'technical failure' },
];

// Appendix B — universal stop rules, verbatim.
const UNIVERSAL_STOP_RULES: string[] = [
  'hold time or reps drop more than ~15%',
  'hips sag during front lever',
  'elbows unlock',
  'HSPU line changes substantially',
  'you need momentum',
  'two consecutive handstand attempts collapse immediately',
];

// Section 7.5's progressive-overload definition, verbatim.
const PROGRESSIVE_OVERLOAD_AXES: string[] = [
  'losing assistance',
  'increasing ROM',
  'improving line',
  'harder lever',
  'same reps at lower bodyweight',
  'more work at the same RPE',
  'less band',
  'less technique variability',
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

  const amExercises = useMemo(() => exercisesFor(program, dayId, 'am', week), [dayId, week]);
  const mainExercises = useMemo(() => exercisesFor(program, dayId, 'main', week), [dayId, week]);

  return (
    <div className="flex h-full flex-col">
      <PhaseBadge week={week} phase={phase} dateLabel={dayTitles[dayId]} />

      <div className="flex-1 overflow-y-auto p-4 text-text">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-text">Program</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={week <= 1}
              onClick={() => setWeek((w) => w - 1)}
              className="min-h-11 min-w-11 text-text disabled:opacity-30"
            >
              ←
            </button>
            <span className="tabular-nums text-sm text-muted">Week {week}</span>
            <button
              type="button"
              disabled={week >= 12}
              onClick={() => setWeek((w) => w + 1)}
              className="min-h-11 min-w-11 text-text disabled:opacity-30"
            >
              →
            </button>
          </div>
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

        <h2 className="mt-4 font-display text-lg text-text">{dayTitles[dayId]}</h2>

        <section className="mt-2 rounded border border-line bg-surface p-3">
          <span className="text-sm text-text">AM</span>
          {amExercises.length === 0 ? (
            <p className="mt-1 text-xs text-muted">No AM work this day.</p>
          ) : (
            <div className="mt-1 divide-y divide-line">
              {amExercises.map((exercise) => (
                <ExerciseEntry key={exercise.id} exercise={exercise} week={week} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 rounded border border-line bg-surface p-3">
          <span className="text-sm text-text">Main</span>
          {mainExercises.length === 0 ? (
            <p className="mt-1 text-xs text-muted">No hard training today.</p>
          ) : (
            <div className="mt-1 divide-y divide-line">
              {mainExercises.map((exercise) => (
                <ExerciseEntry key={exercise.id} exercise={exercise} week={week} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 rounded border border-line bg-surface p-3">
          <span className="text-sm text-text">Phase — {phase}</span>
          <p className="mt-2 text-sm text-text">{PHASE_NOTES[phase]}</p>
        </section>

        <section className="mt-4 rounded border border-line bg-surface p-3">
          <span className="text-sm text-text">RPE reference</span>
          <table className="mt-2 w-full text-left text-xs">
            <thead>
              <tr className="text-muted">
                <th className="py-1 pr-2">RPE</th>
                <th className="py-1">Reserve</th>
              </tr>
            </thead>
            <tbody className="text-text">
              {RPE_REFERENCE.map((r) => (
                <tr key={r.rpe} className="border-t border-line">
                  <td className="py-1 pr-2 tabular-nums">{r.rpe}</td>
                  <td className="py-1">{r.reserve}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">Most skill work stays at RPE 6–8.5.</p>
        </section>

        <section className="mt-4 rounded border border-line bg-surface p-3">
          <span className="text-sm text-text">Universal stop rules</span>
          <p className="mt-1 text-xs text-muted">Stop a skill exercise when:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text">
            {UNIVERSAL_STOP_RULES.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded border border-line bg-surface p-3">
          <span className="text-sm text-text">Progressive overload</span>
          <p className="mt-1 text-xs text-muted">Progress an exercise along any one of these axes:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text">
            {PROGRESSIVE_OVERLOAD_AXES.map((axis, i) => (
              <li key={i}>{axis}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
