// SPEC.md section 7.2. Full-screen, no bottom tab bar.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { parseISO } from 'date-fns';
import { useStore, findPreviousExerciseLog } from '../store/useStore';
import { program } from '../data/program';
import { lookupExercise } from '../data/exercises';
import { ladders } from '../data/ladders';
import { currentWeek, exercisesFor, resolvePrescription } from '../domain/phase';
import { placeholderSetScore } from '../domain/scoring';
import { checkStopRule } from '../domain/analysis';
import { convertWeight, fmtKg, parseWeight } from '../domain/units';
import { roundTo } from '../domain/format';
import { newId } from '../domain/id';
import { runSync } from '../sync/syncEngine';
import type { WeightUnit } from '../domain/units';
import type { Block, Exercise, SetLog, TechniqueFlag } from '../domain/types';
import { formatPrescription } from '../components/ExerciseCard';
import SetLogger, { Stepper } from '../components/SetLogger';
import NumberPad from '../components/NumberPad';
import RestTimer from '../components/RestTimer';
import StopRuleBanner from '../components/StopRuleBanner';
import ProgressionLogger from '../components/ProgressionLogger';

// Rest between sets. v4.0 states rests explicitly for the movements it cares
// about (SPEC-V4.0.md: 4–5 min on the primary HSPU, 90–120 s on arms, 2 min
// recovery between threshold reps), so `exercise.restSeconds` wins where the
// plan gave a number. The metric buckets below remain the fallback for
// everything the plan left unspecified.
function restSecondsFor(exercise: Exercise): number {
  if (exercise.restSeconds !== undefined) return exercise.restSeconds;
  if (exercise.metric === 'sprint') return 240;
  if (exercise.metric === 'hold' || exercise.metric === 'attempts' || exercise.metric === 'weightedReps') {
    return 150;
  }
  return 90;
}

function formatLastTime(sets: SetLog[], metric: Exercise['metric'], unit: WeightUnit): string {
  if (sets.length === 0) return '—';
  if (metric === 'hold' || metric === 'timeOnly' || metric === 'attempts')
    return sets.map((s) => s.seconds ?? '—').join(',') + 's';
  if (metric === 'runInterval') return sets.map((s) => s.minutes ?? '—').join(',') + ' min';
  if (metric === 'carry') {
    const kg = sets[sets.length - 1]?.addedKg;
    const metres = sets.map((s) => s.distanceM ?? '—').join(',');
    return kg ? `${metres} m @ +${fmtKg(kg, unit)} ${unit}` : `${metres} m`;
  }
  const reps = sets.map((s) => s.reps ?? '—').join(',');
  const kg = sets[sets.length - 1]?.addedKg;
  return kg ? `${reps} @ +${fmtKg(kg, unit)} ${unit}` : reps;
}

function formatLoggedSet(set: SetLog, metric: Exercise['metric']): string {
  const rpe = set.rpe !== undefined ? ` RPE ${set.rpe}` : '';
  if (metric === 'hold' || metric === 'timeOnly') return `${set.seconds ?? '—'}s${rpe}`;
  if (metric === 'attempts') return `${(set.attempts ?? []).join(',')}s`;
  if (metric === 'runInterval') {
    const distance = set.distanceM !== undefined ? ` · ${set.distanceM} m` : '';
    return `${set.minutes ?? '—'} min${rpe}${distance}`;
  }
  if (metric === 'carry') return `${set.distanceM ?? '—'} m${rpe}`;
  if (metric === 'sprint') return `${set.distanceM ?? '—'}m @${set.intensityPct ?? '—'}%`;
  if (metric === 'distanceTime') return `${set.reps ?? '—'} min`;
  const rom = set.romCm !== undefined ? ` · ${set.romCm} cm` : '';
  return `${set.reps ?? '—'} reps${rpe}${rom}`;
}

export default function SessionRunner() {
  const params = useParams<{ date: string; block: Block }>();
  const navigate = useNavigate();
  const sessionLogs = useStore((s) => s.sessionLogs);
  const logSet = useStore((s) => s.logSet);
  const completeSession = useStore((s) => s.completeSession);
  const settings = useStore((s) => s.settings);
  const progressionEvents = useStore((s) => s.progressionEvents);
  const addProgressionEvent = useStore((s) => s.addProgressionEvent);

  const sessionId = `${params.date}:${params.block}`;
  const session = sessionLogs[sessionId];

  const exercises = useMemo(() => {
    if (!session) return [];
    const prescribed = exercisesFor(program, session.day, session.block, session.week);

    // Anything already logged into this session but no longer prescribed for
    // the day — a retired exercise, or one moved to another slot — is appended
    // after the prescribed list. Without this, reopening a session logged
    // under earlier programming would silently hide those sets and make them
    // uneditable (SPEC-V3.0.md section 3).
    const prescribedIds = new Set(prescribed.map((e) => e.id));
    const orphans = session.exercises
      .filter((log) => !prescribedIds.has(log.exerciseId) && log.sets.length > 0)
      .map((log) => lookupExercise(log.exerciseId))
      .filter((e): e is Exercise => e !== undefined);

    return [...prescribed, ...orphans];
  }, [session]);

  // Restores the in-progress exercise on refresh: the first one whose target
  // set count isn't yet met, or the last exercise if the session is complete.
  const [index, setIndex] = useState(() => {
    if (!session) return 0;
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const log = session.exercises.find((e) => e.exerciseId === ex.id);
      const targetSets = resolvePrescription(ex, session.week)?.sets ?? 1;
      if (!log || log.sets.length < targetSets) return i;
    }
    return Math.max(0, exercises.length - 1);
  });
  const [ending, setEnding] = useState(false);
  const [restKey, setRestKey] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);

  const exercise = exercises[index];
  const prescription = exercise ? resolvePrescription(exercise, session.week) : null;
  const ladder = exercise?.ladderId ? ladders.find((l) => l.id === exercise.ladderId) : undefined;

  const existingLog = session?.exercises.find((e) => e.exerciseId === exercise?.id);
  const loggedSets = existingLog?.sets ?? [];
  const targetSets = prescription?.sets ?? 1;

  const previous = exercise ? findPreviousExerciseLog(sessionLogs, exercise.id, session.date) : null;

  // Per-set input state, reset whenever the exercise changes.
  const [reps, setReps] = useState<number | undefined>(undefined);
  const [seconds, setSeconds] = useState<number | undefined>(undefined);
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  const [attempts, setAttempts] = useState<number[]>([]);
  const [addedKg, setAddedKg] = useState<number | undefined>(undefined);
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [distanceM, setDistanceM] = useState<number | undefined>(undefined);
  const [intensityPct, setIntensityPct] = useState<number | undefined>(undefined);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [assistanceTier, setAssistanceTier] = useState<number | undefined>(undefined);
  const [romCm, setRomCm] = useState<number | undefined>(undefined);
  const [flags, setFlags] = useState<TechniqueFlag[]>([]);
  const [padField, setPadField] = useState<
    null | 'reps' | 'kg' | 'distance' | 'intensity' | 'minutes' | 'rom'
  >(null);

  // ROM is only an input where the exercise actually progresses on it
  // (SPEC-V3.0.md section 2) — currently Monday's two v3 HSPU movements.
  const showRom = exercise?.progressionLadder.includes('greater ROM') ?? false;

  useEffect(() => {
    if (!exercise) return;
    setReps(prescription?.repsLow ?? previous?.log.sets.at(-1)?.reps);
    setSeconds(undefined);
    // Run blocks and carries have their duration/distance PRESCRIBED — the
    // whole point of "3 × 8 min" is that you run 8 minutes. Prefilling them
    // makes logging a block two taps instead of five.
    setMinutes(prescription?.minutesEach);
    setAttempts([]);
    setAddedKg(previous?.log.sets.at(-1)?.addedKg ?? 0);
    setRpe(prescription?.rpeLow ?? (exercise.rpeScale === 'run' ? 3 : 7));
    setDistanceM(prescription?.distanceM);
    setIntensityPct(undefined);
    setVariantId(previous?.log.sets.at(-1)?.variantId);
    setAssistanceTier(previous?.log.sets.at(-1)?.assistanceTier ?? 0);
    // Depth carries forward from last session like addedKg does: it is a rig
    // setup you dial in once, not a per-set decision.
    setRomCm(previous?.log.sets.at(-1)?.romCm);
    setFlags([]);
    // Deliberately doesn't reset restSeconds: SPEC.md 7.2/acceptance test 9
    // requires the rest timer to survive navigating between exercises.
  }, [exercise?.id]);

  if (!session) {
    return (
      <div className="p-4">
        <p className="text-text">No session found.</p>
        <button className="mt-2 underline text-text" onClick={() => navigate('/')}>
          Back to Today
        </button>
      </div>
    );
  }

  function logCurrentSet() {
    if (!exercise) return;
    const base = { id: newId(), techniqueFlags: flags, variantId, assistanceTier, romCm };
    let setLog: SetLog;
    switch (exercise.metric) {
      case 'hold':
      case 'timeOnly':
        setLog = { ...base, seconds, rpe, score: placeholderSetScore({ seconds }) };
        break;
      case 'runInterval':
        setLog = { ...base, minutes, rpe, distanceM, score: placeholderSetScore({ minutes }) };
        break;
      case 'carry':
        setLog = { ...base, distanceM, addedKg, rpe, score: placeholderSetScore({ distanceM }) };
        break;
      case 'attempts':
        setLog = {
          ...base,
          attempts,
          seconds: attempts.length ? Math.max(...attempts) : undefined,
          score: placeholderSetScore({ attempts }),
        };
        break;
      case 'weightedReps':
        setLog = { ...base, reps, addedKg, rpe, score: placeholderSetScore({ reps }) };
        break;
      case 'sprint':
        setLog = { ...base, distanceM, intensityPct, score: 0 };
        break;
      case 'distanceTime':
        setLog = { ...base, reps, score: placeholderSetScore({ reps }) };
        break;
      default:
        setLog = { ...base, reps, rpe, score: placeholderSetScore({ reps }) };
    }
    logSet(sessionId, exercise.id, setLog);
    setFlags([]);
    setAttempts([]);
    setRestSeconds(restSecondsFor(exercise));
    setRestKey((k) => k + 1);
  }

  const lastLoggedSet = loggedSets.at(-1);
  const stopRuleResult =
    exercise && lastLoggedSet
      ? checkStopRule({
          exercise,
          set: lastLoggedSet,
          previousSetThisExercise: loggedSets.length >= 2 ? loggedSets[loggedSets.length - 2] : undefined,
          firstSetThisSession: loggedSets.length >= 2 ? loggedSets[0] : undefined,
          week: session.week,
        })
      : null;

  if (ending) {
    return (
      <SessionEndForm
        onFinish={(sessionRpe, note) => {
          completeSession(sessionId, { sessionRpe, note });
          // Finishing a session is the moment the athlete most wants their
          // other device to be current, and the moment they are most likely
          // to put the phone away — don't wait out the 2 s write debounce.
          void runSync();
          navigate('/');
        }}
        onBack={() => setEnding(false)}
      />
    );
  }

  if (!exercise) {
    return (
      <div className="p-4">
        <p className="text-text">Nothing to log for this session.</p>
        <button className="mt-2 underline text-text" onClick={() => navigate('/')}>
          Back to Today
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line p-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          className="min-h-11 min-w-11 text-text disabled:opacity-30"
        >
          ←
        </button>
        <span className="tabular-nums text-muted">
          {index + 1}/{exercises.length}
        </span>
        <h1 className="font-display text-lg text-text">{exercise.name}</h1>
        <button type="button" onClick={() => navigate('/')} className="ml-auto min-h-11 min-w-11 text-muted">
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="text-sm text-muted">TARGET {formatPrescription(prescription)}</div>
        <div className="mt-1 text-sm text-muted">
          Last time{previous ? ` (Wk${previous.session.week})` : ''}:{' '}
          {formatLastTime(previous?.log.sets ?? [], exercise.metric, settings.weightUnit)}
        </div>

        <StopRuleBanner result={stopRuleResult} />

        {exercise.progressionLadder.length > 0 && (
          <ProgressionLogger
            exercise={exercise}
            date={session.date}
            week={session.week}
            progressionEvents={progressionEvents}
            weekOfDate={(date) => currentWeek(parseISO(date), settings.blockStartDate)}
            onSave={addProgressionEvent}
          />
        )}

        {ladder && (
          <div className="mt-3 flex gap-3 text-sm">
            <label className="flex-1">
              <span className="block text-xs text-muted">Variant</span>
              <select
                value={variantId ?? ''}
                onChange={(e) => setVariantId(e.target.value || undefined)}
                className="mt-1 min-h-11 w-full rounded border border-line bg-surface-2 px-2 text-text"
              >
                <option value="">—</option>
                {ladder.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="block text-xs text-muted">Assistance</span>
              <select
                value={assistanceTier ?? 0}
                onChange={(e) => setAssistanceTier(Number(e.target.value))}
                className="mt-1 min-h-11 w-full rounded border border-line bg-surface-2 px-2 text-text"
              >
                {ladder.assistanceTiers.map((tier, i) => (
                  <option key={tier} value={i}>
                    {tier}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* A suitcase carry progresses on load exactly like a weighted rep does —
            the 30 m is fixed by the plan. */}
        {(exercise.metric === 'weightedReps' || exercise.metric === 'carry') && (
          <label className="mt-3 block text-sm">
            <span className="text-xs text-muted">Added {settings.weightUnit}</span>
            <button
              type="button"
              onClick={() => setPadField('kg')}
              className="mt-1 min-h-11 w-full rounded border border-line bg-surface-2 px-3 text-left tabular-nums text-text"
            >
              {fmtKg(addedKg ?? 0, settings.weightUnit)}
            </button>
          </label>
        )}

        <div className="mt-4 space-y-2">
          {Array.from({ length: Math.max(targetSets, loggedSets.length) }, (_, i) => i).map((i) => {
            const logged = loggedSets[i];
            const isActive = i === loggedSets.length;

            if (logged) {
              return (
                <div key={i} className="flex items-center justify-between text-sm text-muted">
                  <span>SET {i + 1}</span>
                  <span className="tabular-nums">{formatLoggedSet(logged, exercise.metric)}</span>
                  <span>✓</span>
                </div>
              );
            }

            if (!isActive) {
              return (
                <div key={i} className="flex items-center justify-between text-sm text-muted opacity-40">
                  <span>SET {i + 1}</span>
                  <span>—</span>
                </div>
              );
            }

            return (
              <div key={i} className="rounded border border-line bg-surface p-2">
                <div className="mb-1 text-xs uppercase tracking-wide text-muted">SET {i + 1}</div>
                <SetLogger
                  metric={exercise.metric}
                  rpeScale={exercise.rpeScale ?? 'strength'}
                  reps={reps}
                  onRepsChange={setReps}
                  onTapReps={() => setPadField('reps')}
                  rpe={rpe}
                  onRpeChange={setRpe}
                  seconds={seconds}
                  attempts={attempts}
                  onAttempt={(s) => setAttempts((a) => [...a, s])}
                  onHoldComplete={setSeconds}
                  minutes={minutes}
                  onTapMinutes={() => setPadField('minutes')}
                  distanceM={distanceM}
                  onTapDistance={() => setPadField('distance')}
                  intensityPct={intensityPct}
                  onTapIntensity={() => setPadField('intensity')}
                  flags={flags}
                  onToggleFlag={(flag) =>
                    setFlags((f) => (f.includes(flag) ? f.filter((x) => x !== flag) : [...f, flag]))
                  }
                  showRom={showRom}
                  romCm={romCm}
                  onTapRom={() => setPadField('rom')}
                  onLogSet={logCurrentSet}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-between text-sm">
          {index < exercises.length - 1 ? (
            <button type="button" className="underline text-text" onClick={() => setIndex((i) => i + 1)}>
              Next exercise →
            </button>
          ) : (
            <button type="button" className="underline text-text" onClick={() => setEnding(true)}>
              Finish session
            </button>
          )}
        </div>
      </div>

      {restSeconds !== null && (
        <RestTimer key={restKey} seconds={restSeconds} onDone={() => setRestSeconds(null)} />
      )}

      <NumberPad open={padField === 'reps'} label="Reps" value={reps} onConfirm={setReps} onClose={() => setPadField(null)} />
      <NumberPad
        open={padField === 'kg'}
        label={`Added ${settings.weightUnit}`}
        value={addedKg !== undefined ? roundTo(convertWeight(addedKg, settings.weightUnit), 1) : undefined}
        allowDecimal
        onConfirm={(v) => setAddedKg(parseWeight(v, settings.weightUnit))}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'distance'}
        label="Distance (m)"
        value={distanceM}
        onConfirm={setDistanceM}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'intensity'}
        label="Intensity (%)"
        value={intensityPct}
        onConfirm={setIntensityPct}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'minutes'}
        label="Minutes"
        value={exercise.metric === 'runInterval' ? minutes : reps}
        allowDecimal
        onConfirm={exercise.metric === 'runInterval' ? setMinutes : setReps}
        onClose={() => setPadField(null)}
      />
      <NumberPad
        open={padField === 'rom'}
        label="Depth — pad height (cm)"
        value={romCm}
        onConfirm={setRomCm}
        onClose={() => setPadField(null)}
      />
    </div>
  );
}

function SessionEndForm({
  onFinish,
  onBack,
}: {
  onFinish: (sessionRpe: number, note: string) => void;
  onBack: () => void;
}) {
  const [sessionRpe, setSessionRpe] = useState(7);
  const [note, setNote] = useState('');

  return (
    <div className="flex h-full flex-col p-4">
      <h1 className="font-display text-2xl text-text">Finish session</h1>
      <label className="mt-4 block text-sm">
        <span className="text-muted">Session RPE</span>
        <Stepper label="" value={sessionRpe} min={1} max={10} step={0.5} onChange={setSessionRpe} />
      </label>
      <label className="mt-4 block text-sm">
        <span className="text-muted">Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 min-h-24 w-full rounded border border-line bg-surface-2 p-2 text-text"
        />
      </label>
      <div className="mt-auto flex gap-2 pt-6">
        <button className="min-h-11 flex-1 rounded border border-line text-text" onClick={onBack}>
          Back
        </button>
        <button className="min-h-11 flex-1 rounded bg-good text-bg" onClick={() => onFinish(sessionRpe, note)}>
          Finish
        </button>
      </div>
    </div>
  );
}
