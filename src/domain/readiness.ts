// Autoregulation and joint-irritation volume warnings — SPEC.md section 6.10 as
// amended by SPEC-V4.0.md section 7.
//
// v4.0 deleted SPEC.md 6.9's optional-second-run gate along with the sprint
// session it keyed off. Running is no longer an earned extra: the plan
// prescribes five to six runs a week outright, so there is nothing to gate.
import { program } from '../data/program';
import { relevantJoint } from './analysis';
import type { Joint } from './analysis';
import type { DayId, Readiness } from './types';

// ---------------------------------------------------------------------------
// 6.10 — Autoregulation
// ---------------------------------------------------------------------------

/** sleep < 6h or soreness = 3 → drop every target RPE by 0.5 this session. */
export function autoregulationAdjustment(readiness: Readiness): { rpeDelta: number; message: string } | null {
  if (readiness.sleepHours < 6 || readiness.soreness === 3) {
    return { rpeDelta: -0.5, message: 'Adjusted for recovery' };
  }
  return null;
}

export interface JointVolumeWarning {
  message: string;
  suggestedExerciseIds: string[];
}

/**
 * Which of the current program's exercises load a given joint, and on which
 * days.
 *
 * Derived from `program` rather than listed by hand. The pre-v4 code hardcoded
 * "elbow days are Tuesday and Friday", which silently became wrong the moment
 * the training split moved — the banner kept firing on the old days.
 */
function prescribedIdsForJoint(joint: Joint): string[] {
  return program.filter((e) => relevantJoint(e.id) === joint).map((e) => e.id);
}

function isWarningDay(joint: Joint, day: DayId): boolean {
  return program.some((e) => e.day === day && relevantJoint(e.id) === joint);
}

const JOINT_MESSAGE: Record<Joint, string> = {
  elbow: 'Reduce lever, pull-up and curl volume this session.',
  shoulder: 'Reduce pressing and dip volume this session.',
  achilles: 'Calf and Achilles irritation is building. Cut a run block or drop the calf work today.',
};

/**
 * A joint-volume warning for `day`, or null.
 *
 * Fires when the last two check-ins both reported irritation of 2 or worse in
 * the joint, and the day being viewed actually loads that joint — there is no
 * point telling someone to cut pressing volume on a run day.
 *
 * `recentReadiness` is most-recent-first (the last two check-ins as of today).
 */
export function jointVolumeWarning(
  joint: Joint,
  day: DayId,
  recentReadiness: Readiness[],
): JointVolumeWarning | null {
  if (!isWarningDay(joint, day)) return null;
  const last2 = recentReadiness.slice(0, 2);
  if (last2.length < 2) return null;

  const irritated = last2.every((r) => {
    switch (joint) {
      case 'elbow':
        return r.elbowIrritation >= 2;
      case 'shoulder':
        return r.shoulderIrritation >= 2;
      case 'achilles':
        return r.achillesIrritation >= 2;
    }
  });
  if (!irritated) return null;

  return {
    message: JOINT_MESSAGE[joint],
    suggestedExerciseIds: prescribedIdsForJoint(joint).filter((id) =>
      program.some((e) => e.id === id && e.day === day),
    ),
  };
}

/** Every joint warning that applies to a given day, in a stable order. */
export function jointVolumeWarnings(day: DayId, recentReadiness: Readiness[]): JointVolumeWarning[] {
  const joints: Joint[] = ['elbow', 'shoulder', 'achilles'];
  return joints
    .map((joint) => jointVolumeWarning(joint, day, recentReadiness))
    .filter((w): w is JointVolumeWarning => w !== null);
}
