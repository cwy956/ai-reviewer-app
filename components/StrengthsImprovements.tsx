import type { CitedPoint } from "@/lib/reportSchema";

export function PageBadges({ pageRefs }: { pageRefs: number[] }) {
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

/** Renders a CitedPoint as a bold scannable headline + a dimmer supporting sentence underneath,
 * so a reviewer skimming the page catches the point without reading full prose. Falls back to the
 * old single-line rendering for reports saved before `headline` existed. */
export function CitedPointItem({ point }: { point: CitedPoint }) {
  if (!point.headline) {
    return (
      <li className="leading-relaxed">
        {point.text}
        <PageBadges pageRefs={point.pageRefs} />
      </li>
    );
  }
  return (
    <li className="leading-relaxed">
      <span className="font-medium text-foreground">{point.headline}</span>
      <PageBadges pageRefs={point.pageRefs} />
      <p className="mt-0.5 text-sm text-muted">{point.text}</p>
    </li>
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
        <ul className="space-y-3 text-sm">
          {strengths.map((s, i) => (
            <CitedPointItem key={i} point={s} />
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-warn/30 bg-warn/5 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-warn">⚠ 보강 포인트</h3>
        <ul className="space-y-3 text-sm">
          {improvements.map((s, i) => (
            <CitedPointItem key={i} point={s} />
          ))}
        </ul>
      </div>
    </div>
  );
}
