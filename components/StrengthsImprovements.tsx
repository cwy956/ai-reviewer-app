import type { CitedPoint } from "@/lib/reportSchema";

function PageBadges({ pageRefs }: { pageRefs: number[] }) {
  if (!pageRefs || pageRefs.length === 0) return null;
  return (
    <span className="ml-2 inline-flex gap-1">
      {pageRefs.map((p) => (
        <span key={p} className="rounded border border-panel-border px-1.5 py-0.5 text-[10px] text-muted">
          p.{String(p).padStart(2, "0")}
        </span>
      ))}
    </span>
  );
}

export function StrengthsImprovements({
  strengths,
  improvements,
}: {
  strengths: CitedPoint[];
  improvements: CitedPoint[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-good/30 bg-good/5 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-good">✓ 핵심 강점</h3>
        <ul className="space-y-2.5 text-sm">
          {strengths.map((s, i) => (
            <li key={i} className="leading-relaxed">
              {s.text}
              <PageBadges pageRefs={s.pageRefs} />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-warn/30 bg-warn/5 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-warn">⚠ 보강 포인트</h3>
        <ul className="space-y-2.5 text-sm">
          {improvements.map((s, i) => (
            <li key={i} className="leading-relaxed">
              {s.text}
              <PageBadges pageRefs={s.pageRefs} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
