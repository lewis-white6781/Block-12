// SPEC.md section 8 — large tabular numerals, the content is the number.
interface StatProps {
  label: string;
  value: string;
  sublabel?: string;
}

export default function Stat({ label, value, sublabel }: StatProps) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-3xl tabular-nums text-text">{value}</div>
      {sublabel && <div className="text-xs text-muted">{sublabel}</div>}
    </div>
  );
}
