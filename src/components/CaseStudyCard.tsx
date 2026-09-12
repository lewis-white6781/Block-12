// Case-study protocol card (More screen) — v5.1 analytics (brief §A).
//
// A compact, versioned measurement protocol: define the question, anchors,
// windows and comparison rules BEFORE reading results. Creation freezes a note
// about how much data already existed; amendments are append-only with a date
// and reason. Methodology lives here and in exports — never in the set flow.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { exerciseName } from '../data/exercises';
import { todayISO } from '../domain/clock';
import {
  blockEndDate,
  buildProtocolMarkdown,
  preexistingDataNote,
} from '../store/analysisPack';
import { toPersistedState, triggerDownload } from '../store/persist';
import { inputClass } from '../styles/ui';
import type { CaseStudyProtocol } from '../domain/types';
import Card from './Card';
import SectionHeader from './SectionHeader';

const DEFAULT_QUESTION =
  'Over a 12-week block, how can performance, adherence and recovery data inform progression ' +
  'decisions while monitoring strength during weight loss?';

const ANCHOR_CANDIDATES = ['ring-dip', 'ring-pullup', 'hack-squat', 'fl-hold-primary', 'hspu-primary'];

const DEFAULT_BASELINE = 'Best qualifying set in weeks 1–2, within the same variant and assistance tier.';
const DEFAULT_ENDPOINT = 'Best qualifying set in weeks 11–12, within the same variant and assistance tier.';
const DEFAULT_COMPARISON =
  'Compare within the same exercise, variant and assistance tier, in the movement’s own unit. ' +
  'A variant change is a progression event, not a comparable number. Change from the frozen ' +
  'baseline and percentage of block best are reported as separate measures. Deload weeks ' +
  'prescribe less work by design and are never counted as decline or non-adherence.';
const DEFAULT_MISSING =
  'Missing observations are excluded from means and reported as unavailable — never estimated, ' +
  'never zero-filled. A missing session log is "unknown", not a missed workout. If a baseline ' +
  'window has no qualifying set, the baseline is reported as unavailable.';
const DEFAULT_PRIMARY =
  'Bodyweight trajectory vs the 80→73 kg plan; strength retention on the anchor exercises vs the frozen baseline.';
const DEFAULT_SECONDARY =
  'Front lever and HSPU progression by variant; session adherence with unknowns visible; decision follow-up outcomes.';

interface FormState {
  question: string;
  anchors: string[];
  primaryOutcomes: string;
  secondaryOutcomes: string;
  baselineWindow: string;
  endpointWindow: string;
  comparisonRules: string;
  missingDataRule: string;
  followUpSessions: number;
}

function formFromProtocol(p: CaseStudyProtocol | null, fallbackAnchors: string[]): FormState {
  return {
    question: p?.question ?? DEFAULT_QUESTION,
    anchors: p?.anchorExerciseIds ?? fallbackAnchors,
    primaryOutcomes: p?.primaryOutcomes ?? DEFAULT_PRIMARY,
    secondaryOutcomes: p?.secondaryOutcomes ?? DEFAULT_SECONDARY,
    baselineWindow: p?.baselineWindow ?? DEFAULT_BASELINE,
    endpointWindow: p?.endpointWindow ?? DEFAULT_ENDPOINT,
    comparisonRules: p?.comparisonRules ?? DEFAULT_COMPARISON,
    missingDataRule: p?.missingDataRule ?? DEFAULT_MISSING,
    followUpSessions: p?.followUpSessions ?? 3,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function CaseStudyCard() {
  const navigate = useNavigate();
  const protocol = useStore((s) => s.caseStudyProtocol);
  const saveCaseStudyProtocol = useStore((s) => s.saveCaseStudyProtocol);
  const settings = useStore((s) => s.settings);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => formFromProtocol(protocol, ANCHOR_CANDIDATES.slice(0, 4)));
  const [amendReason, setAmendReason] = useState('');
  const [amendChange, setAmendChange] = useState('');

  const isAmendment = protocol !== null;
  const canSave =
    form.question.trim().length > 0 &&
    form.anchors.length > 0 &&
    (!isAmendment || (amendReason.trim().length > 0 && amendChange.trim().length > 0));

  function openEditor() {
    setForm(formFromProtocol(protocol, ANCHOR_CANDIDATES.slice(0, 4)));
    setAmendReason('');
    setAmendChange('');
    setEditing(true);
  }

  function toggleAnchor(id: string) {
    setForm((f) => ({
      ...f,
      anchors: f.anchors.includes(id) ? f.anchors.filter((a) => a !== id) : [...f.anchors, id],
    }));
  }

  function save() {
    const now = new Date().toISOString();
    if (protocol) {
      saveCaseStudyProtocol({
        ...protocol,
        version: protocol.version + 1,
        question: form.question.trim(),
        anchorExerciseIds: form.anchors,
        primaryOutcomes: form.primaryOutcomes.trim(),
        secondaryOutcomes: form.secondaryOutcomes.trim() || undefined,
        baselineWindow: form.baselineWindow.trim(),
        endpointWindow: form.endpointWindow.trim(),
        comparisonRules: form.comparisonRules.trim(),
        missingDataRule: form.missingDataRule.trim(),
        followUpSessions: form.followUpSessions,
        amendments: [
          ...protocol.amendments,
          { date: now, version: protocol.version + 1, reason: amendReason.trim(), change: amendChange.trim() },
        ],
      });
    } else {
      const state = toPersistedState(useStore.getState());
      const { note, retrospective } = preexistingDataNote(state, todayISO());
      saveCaseStudyProtocol({
        version: 1,
        createdAt: now,
        question: form.question.trim(),
        startDate: settings.blockStartDate,
        endDate: blockEndDate(settings.blockStartDate),
        anchorExerciseIds: form.anchors,
        primaryOutcomes: form.primaryOutcomes.trim(),
        secondaryOutcomes: form.secondaryOutcomes.trim() || undefined,
        baselineWindow: form.baselineWindow.trim(),
        endpointWindow: form.endpointWindow.trim(),
        comparisonRules: form.comparisonRules.trim(),
        missingDataRule: form.missingDataRule.trim(),
        followUpSessions: form.followUpSessions,
        preexistingDataNote: note,
        retrospective,
        amendments: [],
      });
    }
    setEditing(false);
  }

  function exportProtocol() {
    if (!protocol) return;
    triggerDownload(`block12-protocol-v${protocol.version}-${todayISO()}.md`, buildProtocolMarkdown(protocol), 'text/markdown');
  }

  return (
    <Card className="mt-4">
      <SectionHeader>Case study</SectionHeader>
      <p className="mt-1 text-xs text-muted">
        A versioned measurement protocol: the question, anchor exercises, baseline/endpoint windows
        and comparison rules — defined before reading results. Amendments are dated and reasoned.
      </p>

      {!editing && (
        <>
          {protocol ? (
            <div className="mt-3 space-y-1 text-xs">
              <p className="text-text">
                v{protocol.version} · created {protocol.createdAt.slice(0, 10)} ·{' '}
                {protocol.amendments.length} amendment{protocol.amendments.length === 1 ? '' : 's'}
              </p>
              <p className="text-muted">{protocol.question}</p>
              <p className="text-muted">
                Anchors: {protocol.anchorExerciseIds.map((id) => exerciseName(id)).join(', ')}
              </p>
              {protocol.retrospective && (
                <p className="text-warn">
                  Recorded after training began — pre-existing data is analysed retrospectively.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-text">No protocol recorded yet.</p>
          )}
          <div className="mt-3 space-y-2">
            <button type="button" onClick={openEditor} className="min-h-11 w-full rounded border border-line text-sm text-text">
              {protocol ? 'Amend protocol' : 'Create protocol'}
            </button>
            {protocol && (
              <button type="button" onClick={exportProtocol} className="min-h-11 w-full rounded border border-line text-sm text-text">
                Export protocol.md
              </button>
            )}
            <button type="button" onClick={() => navigate('/decisions')} className="min-h-11 w-full rounded border border-line text-sm text-text">
              Open decision journal
            </button>
          </div>
        </>
      )}

      {editing && (
        <div className="mt-3 space-y-3">
          <Field label="Question">
            <textarea
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              rows={3}
              className={`${inputClass} py-2`}
            />
          </Field>
          <Field label="Anchor exercises">
            <div className="space-y-1">
              {ANCHOR_CANDIDATES.map((id) => (
                <label key={id} className="flex min-h-11 items-center gap-2 text-sm text-text">
                  <input type="checkbox" checked={form.anchors.includes(id)} onChange={() => toggleAnchor(id)} />
                  {exerciseName(id)}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Primary outcomes">
            <textarea
              value={form.primaryOutcomes}
              onChange={(e) => setForm((f) => ({ ...f, primaryOutcomes: e.target.value }))}
              rows={2}
              className={`${inputClass} py-2`}
            />
          </Field>
          <Field label="Secondary outcomes">
            <textarea
              value={form.secondaryOutcomes}
              onChange={(e) => setForm((f) => ({ ...f, secondaryOutcomes: e.target.value }))}
              rows={2}
              className={`${inputClass} py-2`}
            />
          </Field>
          <Field label="Baseline window">
            <textarea
              value={form.baselineWindow}
              onChange={(e) => setForm((f) => ({ ...f, baselineWindow: e.target.value }))}
              rows={2}
              className={`${inputClass} py-2`}
            />
          </Field>
          <Field label="Endpoint window">
            <textarea
              value={form.endpointWindow}
              onChange={(e) => setForm((f) => ({ ...f, endpointWindow: e.target.value }))}
              rows={2}
              className={`${inputClass} py-2`}
            />
          </Field>
          <Field label="Comparison rules">
            <textarea
              value={form.comparisonRules}
              onChange={(e) => setForm((f) => ({ ...f, comparisonRules: e.target.value }))}
              rows={4}
              className={`${inputClass} py-2`}
            />
          </Field>
          <Field label="Missing-data rule">
            <textarea
              value={form.missingDataRule}
              onChange={(e) => setForm((f) => ({ ...f, missingDataRule: e.target.value }))}
              rows={3}
              className={`${inputClass} py-2`}
            />
          </Field>
          <Field label="Decision follow-up window (comparable sessions)">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={14}
              value={form.followUpSessions}
              onChange={(e) =>
                setForm((f) => ({ ...f, followUpSessions: Math.max(1, Math.min(14, Number(e.target.value) || 3)) }))
              }
              className={inputClass}
            />
          </Field>
          {isAmendment && (
            <>
              <Field label="What changed (required for an amendment)">
                <input value={amendChange} onChange={(e) => setAmendChange(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Why (required)">
                <input value={amendReason} onChange={(e) => setAmendReason(e.target.value)} className={inputClass} />
              </Field>
            </>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="min-h-11 flex-1 rounded border border-line text-sm text-text">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="min-h-11 flex-1 rounded bg-good text-sm font-medium text-bg disabled:opacity-40"
            >
              {isAmendment ? `Save as v${(protocol?.version ?? 0) + 1}` : 'Create protocol'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
