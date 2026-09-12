// Decision journal — v5.1 analytics (Block12 academic brief §C/§D).
//
// One place to record what the system showed, what was decided, what actually
// changed, and — after the follow-up window — what the logs then showed.
// Entries are evidence for the case study: the decision-time fields are frozen
// at save and the follow-up separates computed observation from judgement.
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { program } from '../data/program';
import { exerciseName } from '../data/exercises';
import { currentWeek, phaseForWeek } from '../domain/phase';
import { comparableSessionsSince, followUpStatus, isRetrospective } from '../domain/decisions';
import { newId } from '../domain/id';
import { useToday } from '../hooks/useToday';
import { useUpdateStore } from '../pwa/updateStore';
import { inputClass } from '../styles/ui';
import type {
  DecisionChoice,
  DecisionEntry,
  DecisionSource,
  FollowUpOutcome,
} from '../domain/types';
import PhaseBadge from '../components/PhaseBadge';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';

const SOURCE_LABEL: Record<DecisionSource, string> = {
  stagnation: 'Stagnation alert',
  stopRule: 'Stop-rule banner',
  guardrail: 'Guardrail',
  jointWarning: 'Joint-volume warning',
  weeklyReview: 'Weekly review',
  manual: 'Manual',
};

const CHOICE_LABEL: Record<DecisionChoice, string> = {
  accepted: 'Accepted the recommendation',
  deferred: 'Deferred it',
  rejected: 'Rejected it',
  overridden: 'Did something different',
  manual: 'Own decision (no recommendation)',
};

const OUTCOME_LABEL: Record<FollowUpOutcome, string> = {
  improved: 'Improved',
  maintained: 'Maintained',
  declined: 'Declined',
  notComparable: 'Not comparable (variant/exercise changed)',
  insufficientData: 'Insufficient data',
};

/** What a system alert hands over when it prefills a new entry. */
export interface DecisionPrefill {
  source?: DecisionSource;
  exerciseId?: string;
  evidence?: string;
  recommendation?: string;
  progressionEventId?: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function NewEntryForm({ prefill, onDone }: { prefill: DecisionPrefill; onDone: () => void }) {
  const addDecisionEntry = useStore((s) => s.addDecisionEntry);
  const protocol = useStore((s) => s.caseStudyProtocol);
  const appVersion = useUpdateStore((s) => s.version);
  const today = useToday();

  const [source, setSource] = useState<DecisionSource>(prefill.source ?? 'manual');
  const [exerciseId, setExerciseId] = useState(prefill.exerciseId ?? '');
  const [evidence, setEvidence] = useState(prefill.evidence ?? '');
  const [recommendation, setRecommendation] = useState(prefill.recommendation ?? '');
  const [decision, setDecision] = useState<DecisionChoice>(prefill.recommendation ? 'accepted' : 'manual');
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [expected, setExpected] = useState('');
  const [followWindow, setFollowWindow] = useState(protocol?.followUpSessions ?? 3);

  const canSave = evidence.trim().length > 0 && action.trim().length > 0;

  function save() {
    addDecisionEntry({
      id: newId(),
      eventDate: format(today, 'yyyy-MM-dd'),
      createdAt: new Date().toISOString(),
      source,
      exerciseId: exerciseId || undefined,
      evidence: evidence.trim(),
      recommendation: recommendation.trim() || undefined,
      ruleVersion: appVersion,
      decision,
      action: action.trim(),
      reason: reason.trim() || undefined,
      expectedObservation: expected.trim() || undefined,
      followUpSessions: followWindow,
      progressionEventId: prefill.progressionEventId,
    });
    onDone();
  }

  return (
    <Card className="mt-4">
      <SectionHeader>New decision</SectionHeader>
      <div className="mt-2 space-y-3">
        <Field label="Prompted by">
          <select value={source} onChange={(e) => setSource(e.target.value as DecisionSource)} className={inputClass}>
            {(Object.keys(SOURCE_LABEL) as DecisionSource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Exercise (optional)">
          <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className={inputClass}>
            <option value="">— none / general —</option>
            {program
              .filter((e) => e.tracked)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Evidence at the time (numbers, dates, what was on screen)">
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={3}
            className={`${inputClass} py-2`}
            placeholder="e.g. Ring dip flat 3 sessions: 8, 8, 8 reps at +10 kg. Sleep 7h+, no joint irritation."
          />
        </Field>
        <Field label="Recommendation shown (verbatim, if any)">
          <textarea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            rows={2}
            className={`${inputClass} py-2`}
            placeholder="Leave empty for a self-initiated decision."
          />
        </Field>
        <Field label="Decision">
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as DecisionChoice)}
            className={inputClass}
          >
            {(Object.keys(CHOICE_LABEL) as DecisionChoice[]).map((c) => (
              <option key={c} value={c}>
                {CHOICE_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Action taken (including a deliberate 'hold the plan')">
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className={inputClass}
            placeholder="e.g. Added 2.5 kg to ring dip working sets."
          />
        </Field>
        <Field label="Why (one sentence, optional)">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </Field>
        <Field label="What should be observable if this was right (optional)">
          <input
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            className={inputClass}
            placeholder="e.g. Reps back to 8 at the new load within 3 sessions."
          />
        </Field>
        <Field label="Follow-up window (comparable sessions; days if no exercise)">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={14}
            value={followWindow}
            onChange={(e) => setFollowWindow(Math.max(1, Math.min(14, Number(e.target.value) || 3)))}
            className={inputClass}
          />
        </Field>
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className="min-h-11 flex-1 rounded border border-line text-sm text-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="min-h-11 flex-1 rounded bg-good text-sm font-medium text-bg disabled:opacity-40"
          >
            Save decision
          </button>
        </div>
      </div>
    </Card>
  );
}

function FollowUpForm({ entry, onDone }: { entry: DecisionEntry; onDone: () => void }) {
  const sessionLogs = useStore((s) => s.sessionLogs);
  const updateDecisionEntry = useStore((s) => s.updateDecisionEntry);
  const [observation, setObservation] = useState('');
  const [outcome, setOutcome] = useState<FollowUpOutcome>('maintained');
  const [interpretation, setInterpretation] = useState('');

  const comparable = entry.exerciseId
    ? comparableSessionsSince(sessionLogs, entry.exerciseId, entry.eventDate).length
    : 0;

  function save() {
    updateDecisionEntry(entry.id, {
      followUp: {
        recordedAt: new Date().toISOString(),
        comparableSessions: comparable,
        observation: observation.trim(),
        outcome,
        interpretation: interpretation.trim() || undefined,
      },
    });
    onDone();
  }

  return (
    <div className="mt-2 space-y-2 rounded bg-surface-2 p-2">
      <Field label={`What do the logs show? (${comparable} comparable sessions since)`}>
        <textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          rows={2}
          className={`${inputClass} py-2`}
          placeholder="Numbers and dates, not opinion."
        />
      </Field>
      <Field label="Outcome">
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as FollowUpOutcome)} className={inputClass}>
          {(Object.keys(OUTCOME_LABEL) as FollowUpOutcome[]).map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABEL[o]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Your reading of it (optional)">
        <input value={interpretation} onChange={(e) => setInterpretation(e.target.value)} className={inputClass} />
      </Field>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="min-h-11 flex-1 rounded border border-line text-sm text-text">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={observation.trim().length === 0}
          className="min-h-11 flex-1 rounded bg-good text-sm font-medium text-bg disabled:opacity-40"
        >
          Save follow-up
        </button>
      </div>
    </div>
  );
}

function EntryCard({ entry }: { entry: DecisionEntry }) {
  const sessionLogs = useStore((s) => s.sessionLogs);
  const today = useToday();
  const [recording, setRecording] = useState(false);
  const status = followUpStatus(entry, sessionLogs, format(today, 'yyyy-MM-dd'));

  return (
    <Card className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text">
          {entry.exerciseId ? exerciseName(entry.exerciseId) : 'General'}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted">{entry.eventDate}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1 text-xs">
        <span className="rounded-full border border-line px-2 py-0.5 text-muted">{SOURCE_LABEL[entry.source]}</span>
        <span className="rounded-full border border-line px-2 py-0.5 text-muted">{CHOICE_LABEL[entry.decision]}</span>
        {isRetrospective(entry) && (
          <span className="rounded-full border border-warn px-2 py-0.5 text-warn">Entered retrospectively</span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Evidence: {entry.evidence}</p>
      {entry.recommendation && (
        <p className="mt-1 text-xs text-muted">
          Recommended (v{entry.ruleVersion}): {entry.recommendation}
        </p>
      )}
      <p className="mt-1 text-sm text-text">Action: {entry.action}</p>
      {entry.reason && <p className="mt-1 text-xs text-muted">Why: {entry.reason}</p>}
      {entry.expectedObservation && <p className="mt-1 text-xs text-muted">Expected: {entry.expectedObservation}</p>}

      {entry.followUp ? (
        <div className="mt-2 rounded bg-surface-2 p-2 text-xs">
          <div className="text-muted">
            Follow-up ({entry.followUp.comparableSessions} comparable sessions):{' '}
            <span className="text-text">{OUTCOME_LABEL[entry.followUp.outcome]}</span>
          </div>
          <p className="mt-1 text-text">{entry.followUp.observation}</p>
          {entry.followUp.interpretation && (
            <p className="mt-1 text-muted">Interpretation: {entry.followUp.interpretation}</p>
          )}
        </div>
      ) : recording ? (
        <FollowUpForm entry={entry} onDone={() => setRecording(false)} />
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={`text-xs ${status.kind === 'due' ? 'text-warn' : 'text-muted'}`}>
            {status.kind === 'due'
              ? 'Follow-up due'
              : `Waiting — ${status.kind === 'waiting' ? status.comparableSessions : 0}/${
                  status.kind === 'waiting' ? status.needed : entry.followUpSessions
                } ${entry.exerciseId ? 'comparable sessions' : 'days'}`}
          </span>
          <button
            type="button"
            onClick={() => setRecording(true)}
            className="min-h-11 shrink-0 rounded border border-line px-3 text-xs text-text"
          >
            Record follow-up
          </button>
        </div>
      )}
    </Card>
  );
}

export default function Decisions() {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useStore((s) => s.settings);
  const decisionEntries = useStore((s) => s.decisionEntries);
  const today = useToday();
  const week = currentWeek(today, settings.blockStartDate);

  const prefill = (location.state as { prefill?: DecisionPrefill } | null)?.prefill;
  const [adding, setAdding] = useState(!!prefill);

  const entries = useMemo(
    () =>
      Object.values(decisionEntries).sort(
        (a, b) => b.eventDate.localeCompare(a.eventDate) || b.createdAt.localeCompare(a.createdAt),
      ),
    [decisionEntries],
  );

  return (
    <div className="flex h-full flex-col">
      <PhaseBadge week={week} phase={phaseForWeek(week)} dateLabel="Decisions" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl text-text">Decision journal</h1>
          <button type="button" onClick={() => navigate(-1)} className="min-h-11 rounded border border-line px-3 text-xs text-text">
            Back
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          What was recommended, what you decided, and what the logs showed afterwards. Follow-ups
          separate observation from interpretation.
        </p>

        {adding ? (
          <NewEntryForm prefill={prefill ?? {}} onDone={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-4 min-h-11 w-full rounded bg-good text-sm font-medium text-bg"
          >
            Record a decision
          </button>
        )}

        {entries.length === 0 && !adding ? (
          <Card className="mt-4">
            <p className="text-sm text-text">No decisions recorded yet.</p>
            <p className="mt-1 text-xs text-muted">
              Record one when you accept or override a recommendation, or make a deliberate change —
              including deciding to keep the plan as it is.
            </p>
          </Card>
        ) : (
          entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
