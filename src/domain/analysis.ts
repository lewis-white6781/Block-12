// Stop-rule check, stagnation detector, one-variable rule, tendon guardrails —
// SPEC.md sections 6.6–6.8, 6.11. The real predicate (rolling-best comparison,
// technique flags, phase RPE caps) lands in a later prompt.
import type { SetLog, Exercise } from './types';

export type StopRuleSeverity = 'amber' | 'red';

export interface StopRuleResult {
  severity: StopRuleSeverity;
  message: string;
}

// Stubbed: always silent until SPEC.md section 6.6 is implemented.
export function checkStopRule(
  _exercise: Exercise,
  _set: SetLog,
  _phaseRpeCap: number | undefined,
): StopRuleResult | null {
  return null;
}
