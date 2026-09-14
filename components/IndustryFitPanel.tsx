import type { IndustryFitAssessment } from "@/lib/reportSchema";
import { PageBadges } from "./StrengthsImprovements";

export function IndustryFitPanel({ industryFit }: { industryFit: IndustryFitAssessment }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5">
      <h3 className="mb-1 font-semibold">산업 적합성 진단</h3>
      <p className="mb-4 text-xs text-muted">
        자료 완성도 점수와는 별개로, 자료 속 주장이 이 산업의 통상적 기준에 비추어 근거가 탄탄한지 짚어드려요 (투자
        매력도 판단 아님).
      </p>
      <p className="mb-4 text-sm leading-relaxed text-foreground">{industryFit.summary}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium text-good">탄탄한 지점</h4>
          <ul className="space-y-2 text-sm">
            {industryFit.strongPoints.map((s, i) => (
              <li key={i} className="leading-relaxed">
                {s.text}
                <PageBadges pageRefs={s.pageRefs} />
              </li>
            ))}
            {industryFit.strongPoints.length === 0 && (
              <li className="text-muted">특별히 짚을 만한 지점이 없습니다.</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium text-warn">의문이 남는 지점</h4>
          <ul className="space-y-2 text-sm">
            {industryFit.concerns.map((s, i) => (
              <li key={i} className="leading-relaxed">
                {s.text}
                <PageBadges pageRefs={s.pageRefs} />
              </li>
            ))}
            {industryFit.concerns.length === 0 && <li className="text-muted">특별히 짚을 만한 지점이 없습니다.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
