import type { InvestmentAttractivenessAssessment, InvestmentCriterionAssessment } from "@/lib/reportSchema";
import { CHECK_LABEL_BY_ID, CRITERION_BY_ID } from "@/lib/investmentCriteria";
import { PageBadges, CitedPointItem } from "./StrengthsImprovements";

const VERDICT_STYLE: Record<string, string> = {
  확인됨: "bg-good/15 text-good",
  부분: "bg-warn/15 text-warn",
  "근거 없음": "bg-bad/15 text-bad",
  "해당 없음": "bg-panel text-muted",
};

function CriterionRow({ c }: { c: InvestmentCriterionAssessment }) {
  const weight = CRITERION_BY_ID[c.criterion]?.weight;
  const undeterminable = c.determinable === false;
  const isTop = (weight ?? 0) >= 35;
  const checks = c.checks ?? [];

  return (
    <div className={isTop ? "rounded-md border border-accent/30 bg-panel/40 p-3" : "px-1"}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {c.criterionLabel}
          {weight != null && <span className="ml-2 text-xs font-normal text-muted">가중치 {weight}%</span>}
        </span>
        {undeterminable ? (
          <span className="rounded-full bg-panel px-2 py-0.5 text-xs text-muted">판단 불가 · 종합에서 제외</span>
        ) : (
          <span className="text-muted">{c.score}</span>
        )}
      </div>
      {!undeterminable && (
        <div className="mt-1 h-1.5 w-full rounded-full bg-panel-border">
          <div className="h-1.5 rounded-full bg-accent" style={{ width: `${c.score}%` }} />
        </div>
      )}
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {c.rationale}
        <PageBadges pageRefs={c.pageRefs} />
      </p>

      {checks.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-panel-border pt-3">
          {checks.map((k) => (
            <li key={k.id} className="text-xs leading-relaxed">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-medium ${VERDICT_STYLE[k.verdict] ?? "bg-panel text-muted"}`}>
                  {k.verdict}
                </span>
                <div>
                  <span className="text-foreground">{CHECK_LABEL_BY_ID[k.id] ?? k.id}</span>
                  <p className="mt-0.5 text-muted">
                    {k.evidence}
                    <PageBadges pageRefs={k.pageRefs} />
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InvestmentAttractivenessPanel({
  investmentAttractiveness,
}: {
  investmentAttractiveness: InvestmentAttractivenessAssessment;
}) {
  const { overallScore } = investmentAttractiveness;
  const excluded = investmentAttractiveness.criteria.filter((c) => c.determinable === false).length;

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold text-accent-soft">투자 매력도 진단 (내부 전용)</h3>
        <div className="text-right">
          {overallScore == null ? (
            <span className="text-sm text-muted">판단 불가</span>
          ) : (
            <>
              <span className="text-2xl font-bold text-accent-soft">{overallScore}</span>
              <span className="text-sm text-muted">/100</span>
            </>
          )}
        </div>
      </div>
      <p className="mb-4 text-xs text-muted">
        기술·경쟁우위(35%)와 트랙션 확정도(35%)를 가장 깊게 보고, 나머지 3개는 각 10%예요.
        {excluded > 0 && ` 판단 불가 ${excluded}개는 감점 없이 제외하고 나머지로 계산했어요.`}
      </p>
      <p className="mb-4 text-sm leading-relaxed text-foreground">{investmentAttractiveness.summary}</p>

      <div className="mb-4 space-y-3">
        {investmentAttractiveness.criteria.map((c) => (
          <CriterionRow key={c.criterion} c={c} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium text-good">긍정 요인</h4>
          <ul className="space-y-3 text-sm">
            {investmentAttractiveness.strongPoints.map((s, i) => (
              <CitedPointItem key={i} point={s} />
            ))}
            {investmentAttractiveness.strongPoints.length === 0 && (
              <li className="text-muted">특별히 짚을 만한 지점이 없습니다.</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium text-bad">🚩 우려 요인 (투자 리스크)</h4>
          <ul className="space-y-3 text-sm">
            {investmentAttractiveness.concerns.map((s, i) => (
              <CitedPointItem key={i} point={s} />
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
