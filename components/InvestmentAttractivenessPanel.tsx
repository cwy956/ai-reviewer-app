import type { InvestmentAttractivenessAssessment } from "@/lib/reportSchema";
import { PageBadges } from "./StrengthsImprovements";

export function InvestmentAttractivenessPanel({
  investmentAttractiveness,
}: {
  investmentAttractiveness: InvestmentAttractivenessAssessment;
}) {
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold text-accent-soft">투자 매력도 진단 (내부 전용)</h3>
        <div className="text-right">
          <span className="text-2xl font-bold text-accent-soft">{investmentAttractiveness.overallScore}</span>
          <span className="text-sm text-muted">/100</span>
        </div>
      </div>
      <p className="mb-4 text-xs text-muted">
        기본 5개 기준으로 산정한 초안입니다. 실제 투심보고서 기준으로 추후 보정될 예정이에요.
      </p>
      <p className="mb-4 text-sm leading-relaxed text-foreground">{investmentAttractiveness.summary}</p>

      <div className="mb-4 space-y-2">
        {investmentAttractiveness.criteria.map((c) => (
          <div key={c.criterion}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{c.criterionLabel}</span>
              <span className="text-muted">{c.score}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-accent"
                style={{ width: `${c.score}%` }}
              />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {c.rationale}
              <PageBadges pageRefs={c.pageRefs} />
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium text-good">긍정 요인</h4>
          <ul className="space-y-2 text-sm">
            {investmentAttractiveness.strongPoints.map((s, i) => (
              <li key={i} className="leading-relaxed">
                {s.text}
                <PageBadges pageRefs={s.pageRefs} />
              </li>
            ))}
            {investmentAttractiveness.strongPoints.length === 0 && (
              <li className="text-muted">특별히 짚을 만한 지점이 없습니다.</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium text-warn">우려 요인</h4>
          <ul className="space-y-2 text-sm">
            {investmentAttractiveness.concerns.map((s, i) => (
              <li key={i} className="leading-relaxed">
                {s.text}
                <PageBadges pageRefs={s.pageRefs} />
              </li>
            ))}
            {investmentAttractiveness.concerns.length === 0 && (
              <li className="text-muted">특별히 짚을 만한 지점이 없습니다.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
