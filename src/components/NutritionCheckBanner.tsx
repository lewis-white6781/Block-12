// The weekly calorie check — SPEC-V6.0.md section 6. Reads nutritionCheck()
// and, when it recommends a change, offers it as one tap. Applying stores a
// dated NutritionAdjustment; the table itself is never edited.
import { useMemo } from 'react';
import { fmt } from '../domain/format';
import { nutritionCheck } from '../domain/nutrition';
import type { NutritionCheckStatus } from '../domain/nutrition';
import { useStore } from '../store/useStore';

const TONE: Record<NutritionCheckStatus, 'action' | 'warn' | 'quiet'> = {
  early: 'quiet',
  settling: 'quiet',
  needData: 'quiet',
  onTrack: 'quiet',
  tooSlow: 'action',
  tooFast: 'action',
  overTarget: 'warn',
  underTarget: 'warn',
};

interface NutritionCheckBannerProps {
  /** The day the check is read as of. Apply is only offered for today. */
  date: string;
  isToday: boolean;
  /** Hide the quiet states (on track, too early, waiting for data). */
  actionableOnly?: boolean;
}

export default function NutritionCheckBanner({ date, isToday, actionableOnly }: NutritionCheckBannerProps) {
  const dailyEntries = useStore((s) => s.dailyEntries);
  const settings = useStore((s) => s.settings);
  const addNutritionAdjustment = useStore((s) => s.addNutritionAdjustment);

  const check = useMemo(
    () => nutritionCheck(Object.values(dailyEntries), settings, date),
    [dailyEntries, settings, date],
  );
  const tone = TONE[check.status];
  if (actionableOnly && tone === 'quiet') return null;

  const recommended = check.recommendedKcal;
  const sign = recommended !== null && recommended > 0 ? '+' : '−';

  return (
    <div
      className={`rounded px-3 py-2 text-sm ${
        tone === 'action' ? 'bg-warn text-bg' : tone === 'warn' ? 'border border-warn text-text' : 'bg-surface-2 text-text'
      }`}
    >
      <p>{check.message}</p>
      {recommended !== null && isToday && (
        <button
          type="button"
          onClick={() => addNutritionAdjustment({ date, kcal: recommended, reason: check.message })}
          className="mt-2 block min-h-11 w-full rounded bg-bg text-sm font-medium text-text"
        >
          Apply {sign}
          {fmt(Math.abs(recommended), 0)} kcal from today
        </button>
      )}
    </div>
  );
}
