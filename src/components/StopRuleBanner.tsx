// SPEC.md section 6.6, 7.2. The predicate is stubbed (domain/analysis.ts) until a later prompt.
import type { StopRuleResult } from '../domain/analysis';

interface StopRuleBannerProps {
  result: StopRuleResult | null;
}

export default function StopRuleBanner({ result }: StopRuleBannerProps) {
  if (!result) return null;

  return (
    <div
      className={`rounded px-3 py-2 text-sm ${
        result.severity === 'red' ? 'bg-bad text-bg' : 'bg-warn text-bg'
      }`}
    >
      {result.message}
    </div>
  );
}
