// Analysis-ready export pack — v5.1 analytics (Block12 academic brief §F).
//
// Tidy, documented tables for independent analysis in Tableau / Python / SQL,
// built from the SAME stored records the app reads — nothing here recomputes a
// metric differently from src/domain/. Each dataset has one stated grain, and
// the data dictionary explains the join keys and the one join that must NOT be
// made naively (daily measures onto sets).
//
// Everything is kg-native, ISO-dated, and empty-string for missing values —
// matching the existing sets/daily CSV conventions in persist.ts.
import { addDays, format, parseISO } from 'date-fns';
import { exerciseName, isRetired } from '../data/exercises';
import { program } from '../data/program';
import { retiredExercises } from '../data/retiredExercises';
import { buildWeekCoverage } from '../domain/coverage';
import type { CaseStudyProtocol, DecisionEntry, Exercise, MetricType, SessionLog } from '../domain/types';
import { csvEscape } from './persist';
import type { PersistedState } from './persist';

// ---------- sessions.csv — one row per recorded session ----------

const SESSION_HEADERS = [
  'sessionId',
  'date',
  'week',
  'phase',
  'day',
  'block',
  'startedAt',
  'completedAt',
  'sessionRpe',
  'sleepHours',
  'soreness',
  'elbowIrritation',
  'shoulderIrritation',
  'achillesIrritation',
  'motivation',
  'exercisesLogged',
  'setsLogged',
];

export function buildSessionsCSV(sessionLogs: Record<string, SessionLog>): string {
  const rows: string[] = [SESSION_HEADERS.join(',')];
  const sessions = Object.values(sessionLogs).sort((a, b) => a.id.localeCompare(b.id));
  for (const s of sessions) {
    rows.push(
      [
        s.id,
        s.date,
        s.week,
        s.phase,
        s.day,
        s.block,
        s.startedAt,
        s.completedAt,
        s.sessionRpe,
        s.readiness?.sleepHours,
        s.readiness?.soreness,
        s.readiness?.elbowIrritation,
        s.readiness?.shoulderIrritation,
        s.readiness?.achillesIrritation,
        s.readiness?.motivation,
        s.exercises.filter((e) => e.sets.length > 0).length,
        s.exercises.reduce((sum, e) => sum + e.sets.length, 0),
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return rows.join('\n');
}

// ---------- planned_sessions.csv — one row per prescribed session slot ----------
// Includes dates with NO log, which is the whole point: adherence needs the
// planned denominator, and 'unknown' is visible instead of silently absent.

const PLANNED_HEADERS = ['date', 'week', 'day', 'block', 'status'];

export function buildPlannedSessionsCSV(state: PersistedState, asOfISO: string): string {
  const rows: string[] = [PLANNED_HEADERS.join(',')];
  for (let week = 1; week <= 12; week++) {
    const coverage = buildWeekCoverage({
      week,
      blockStartDate: state.settings.blockStartDate,
      todayISO: asOfISO,
      program,
      sessionLogs: state.sessionLogs,
      dailyEntries: state.dailyEntries,
    });
    for (const slot of coverage.slots) {
      rows.push([slot.date, week, slot.day, slot.block, slot.status].map(csvEscape).join(','));
    }
  }
  return rows.join('\n');
}

// ---------- exercises.csv — one row per exercise definition ----------

const METRIC_UNIT: Record<MetricType, string> = {
  reps: 'reps',
  weightedReps: 'reps + addedKg',
  hold: 'seconds',
  attempts: 'seconds (best attempt)',
  timeOnly: 'seconds (untracked)',
  runInterval: 'minutes + optional metres',
  carry: 'metres + addedKg',
  sprint: 'metres + intensity %',
  distanceTime: 'minutes (stored in reps — pre-v4 legacy)',
};

const EXERCISE_HEADERS = [
  'exerciseId',
  'name',
  'day',
  'block',
  'order',
  'metric',
  'unit',
  'rpeScale',
  'tracked',
  'setsLabel',
  'ladderId',
  'retired',
];

export function buildExercisesCSV(): string {
  const rows: string[] = [EXERCISE_HEADERS.join(',')];
  const all: Exercise[] = [...program, ...retiredExercises];
  for (const e of all) {
    rows.push(
      [
        e.id,
        e.name,
        e.day,
        e.block,
        e.order,
        e.metric,
        METRIC_UNIT[e.metric],
        e.rpeScale ?? 'strength',
        e.tracked,
        e.setsLabel ?? 'sets',
        e.ladderId,
        isRetired(e.id),
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return rows.join('\n');
}

// ---------- decisions.csv — one row per decision journal entry ----------

const DECISION_HEADERS = [
  'decisionId',
  'eventDate',
  'createdAt',
  'retrospectiveEntry',
  'source',
  'exerciseId',
  'exerciseName',
  'evidence',
  'recommendation',
  'ruleVersion',
  'decision',
  'action',
  'reason',
  'expectedObservation',
  'followUpWindow',
  'progressionEventId',
  'followUpRecordedAt',
  'followUpComparableSessions',
  'followUpObservation',
  'followUpOutcome',
  'followUpInterpretation',
];

export function buildDecisionsCSV(decisionEntries: Record<string, DecisionEntry>): string {
  const rows: string[] = [DECISION_HEADERS.join(',')];
  const entries = Object.values(decisionEntries).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  for (const d of entries) {
    rows.push(
      [
        d.id,
        d.eventDate,
        d.createdAt,
        d.createdAt.slice(0, 10) > d.eventDate,
        d.source,
        d.exerciseId,
        d.exerciseId ? exerciseName(d.exerciseId) : '',
        d.evidence,
        d.recommendation,
        d.ruleVersion,
        d.decision,
        d.action,
        d.reason,
        d.expectedObservation,
        d.followUpSessions,
        d.progressionEventId,
        d.followUp?.recordedAt,
        d.followUp?.comparableSessions,
        d.followUp?.observation,
        d.followUp?.outcome,
        d.followUp?.interpretation,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return rows.join('\n');
}

// ---------- manifest.json — provenance for the whole pack ----------

export function buildManifest(state: PersistedState, appVersion: string, asOfISO: string): string {
  const weeks = Array.from({ length: 12 }, (_, i) =>
    buildWeekCoverage({
      week: i + 1,
      blockStartDate: state.settings.blockStartDate,
      todayISO: asOfISO,
      program,
      sessionLogs: state.sessionLogs,
      dailyEntries: state.dailyEntries,
    }),
  );
  const manifest = {
    exportedAt: new Date().toISOString(),
    appVersion,
    schemaVersion: state.schemaVersion,
    blockStartDate: state.settings.blockStartDate,
    startWeightKg: state.settings.startWeightKg,
    targetWeightKg: state.settings.targetWeightKg,
    // Demo provenance: when set, EVERY record in this pack is synthetic seed
    // data and must not be presented as a genuine observation.
    demoSeededAt: state.settings.demoSeededAt ?? null,
    protocolVersion: state.caseStudyProtocol?.version ?? null,
    protocolCreatedAt: state.caseStudyProtocol?.createdAt ?? null,
    counts: {
      sessions: Object.keys(state.sessionLogs).length,
      dailyEntries: Object.keys(state.dailyEntries).length,
      progressionEvents: state.progressionEvents.length,
      decisions: Object.keys(state.decisionEntries).length,
      benchmarkEntries: Object.keys(state.benchmarkEntries).length,
    },
    weeklyCoverage: weeks.map((w) => ({
      week: w.week,
      plannedSlots: w.planned,
      completed: w.completed,
      loggedOnly: w.loggedOnly,
      unknown: w.unknown,
      upcoming: w.upcoming,
      weightDaysOf7: w.weightDays,
      nutritionDaysOf7: w.nutritionDays,
      retrospectiveDailyEntries: w.retrospectiveEntries,
    })),
    conventions: {
      weights: 'kg everywhere',
      dates: 'local training date yyyy-mm-dd; timestamps ISO 8601 UTC',
      missing: 'empty string in CSV, null in JSON — never zero',
      exclusions:
        'qualifying-set rules (technique flags, RPE 10, no raw value) apply only where a column says so; raw rows are never deleted',
    },
  };
  return JSON.stringify(manifest, null, 2);
}

// ---------- data_dictionary.md ----------

export const DATA_DICTIONARY = `# Block 12 analysis pack — data dictionary

Exported by the Block 12 PWA. All weights are kg. All dates are local training
dates (yyyy-mm-dd); timestamps are ISO 8601. Missing values are empty strings —
a missing value means "not recorded", never zero, and a missing session log
means "unknown", never "skipped".

## Files and grain

| File | One row is |
|---|---|
| block12-sets-*.csv | one recorded set (or attempt record) |
| block12-sessions-*.csv | one recorded session, with its readiness check-in |
| block12-daily-*.csv | one day's recorded weight / nutrition / steps |
| block12-planned-sessions-*.csv | one PRESCRIBED session slot, including dates with no log |
| block12-exercises-*.csv | one exercise definition (current and retired) |
| block12-decisions-*.csv | one decision-journal entry with its follow-up |
| block12-manifest-*.json | export provenance, versions, counts, weekly coverage |

## Keys and joins

- \`sets.date + sets.block\` -> \`sessions.sessionId\` (sessionId = "date:block").
- \`sets.exerciseId\` / \`decisions.exerciseId\` -> \`exercises.exerciseId\`.
- \`planned_sessions.date + block\` left-joins to \`sessions\` — rows with
  status \`unknown\`/\`upcoming\` have no session row, by design.
- \`daily.date\` is DAILY grain. Do NOT join calories onto sets and then sum:
  that multiplies intake by the number of sets. Aggregate sets to daily grain
  first, or keep daily measures in their own table.

## Column notes

- \`score\` (sets): the plain comparable value in the movement's own unit
  (reps, seconds, best attempt seconds). No difficulty multiplier.
- \`variantId\`, \`assistanceTier\`, \`romCm\`, \`techniqueFlags\` (sets): comparison
  conditions. Compare within the same variant/assistance; a harder variant is a
  progression event, not a bigger number of the same thing. \`romCm\` is
  lower-is-deeper-is-better.
- \`status\` (planned_sessions): \`completed\` | \`logged\` (partial) |
  \`unknown\` (date passed, nothing recorded — NOT evidence of a missed
  workout) | \`upcoming\`.
- \`retrospectiveEntry\` (decisions): true when the journal entry was written on
  a later day than the decision it records.
- \`phase\` (sessions/sets): the training phase the week prescribes. Deload
  weeks prescribe LESS work — lower volume there is adherence, not decline.
- Demo data: if \`demoSeededAt\` in the manifest is non-null, every record in
  the pack is synthetic demonstration data.
`;

// ---------- protocol.md ----------

export function buildProtocolMarkdown(protocol: CaseStudyProtocol): string {
  const lines = [
    `# Block 12 case-study protocol (v${protocol.version})`,
    '',
    `- **Created:** ${protocol.createdAt}`,
    `- **Status:** ${protocol.retrospective ? 'Recorded after training began — analysis of pre-existing data is retrospective/exploratory, NOT preregistered.' : 'Recorded before the observation window began.'}`,
    '',
    '## Question',
    '',
    protocol.question,
    '',
    '## Observation window',
    '',
    `${protocol.startDate} to ${protocol.endDate}`,
    '',
    '## Anchor exercises',
    '',
    ...protocol.anchorExerciseIds.map((id) => `- ${exerciseName(id)} (\`${id}\`)`),
    '',
    '## Outcomes',
    '',
    `**Primary:** ${protocol.primaryOutcomes}`,
    '',
    ...(protocol.secondaryOutcomes ? [`**Secondary:** ${protocol.secondaryOutcomes}`, ''] : []),
    '## Measurement windows',
    '',
    `- Baseline: ${protocol.baselineWindow}`,
    `- Endpoint: ${protocol.endpointWindow}`,
    '',
    '## Comparison rules',
    '',
    protocol.comparisonRules,
    '',
    '## Missing data',
    '',
    protocol.missingDataRule,
    '',
    '## Decision follow-up window',
    '',
    `${protocol.followUpSessions} comparable sessions (days, for decisions with no linked exercise).`,
    '',
    '## Data existing at protocol creation',
    '',
    protocol.preexistingDataNote,
    '',
    '## Amendments',
    '',
    ...(protocol.amendments.length === 0
      ? ['None.']
      : protocol.amendments.map((a) => `- **v${a.version}** (${a.date}): ${a.change} — _${a.reason}_`)),
    '',
  ];
  return lines.join('\n');
}

/** The note frozen into a protocol at creation, describing what already existed. */
export function preexistingDataNote(state: PersistedState, asOfISO: string): { note: string; retrospective: boolean } {
  const sessions = Object.keys(state.sessionLogs).length;
  const dailies = Object.keys(state.dailyEntries).length;
  const retrospective = sessions > 0 || dailies > 0;
  const note = retrospective
    ? `At protocol creation (${asOfISO}) ${sessions} session log(s) and ${dailies} daily entr(ies) already existed. Analysis of that data is retrospective/exploratory.`
    : `At protocol creation (${asOfISO}) no session logs or daily entries existed.`;
  return { note, retrospective };
}

/** Suggested end date: the last day of the 12-week block. */
export function blockEndDate(blockStartDate: string): string {
  return format(addDays(parseISO(blockStartDate), 83), 'yyyy-MM-dd');
}
