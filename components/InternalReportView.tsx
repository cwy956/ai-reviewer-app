"use client";

import type { ActionItem, CitedPoint, EvaluationReport, InvestmentCriterionAssessment } from "@/lib/reportSchema";
import { CRITERION_BY_ID } from "@/lib/investmentCriteria";
import { PageBadges } from "./StrengthsImprovements";
import { FinancialsCard } from "./FinancialsCard";

const PRIORITY_STYLES: Record<ActionItem["priority"], string> = {
  높음: "bg-bad/15 text-bad",
  중간: "bg-warn/15 text-warn",
  낮음: "bg-black/5 text-muted",
};

const VERDICT_STYLES: Record<string, string> = {
  "적극 검토": "bg-good/15 text-good",
  "조건부 검토": "bg-warn/15 text-warn",
  보류: "bg-bad/15 text-bad",
};

function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 75) return { text: "text-good", bar: "bg-good" };
  if (score >= 55) return { text: "text-warn", bar: "bg-warn" };
  return { text: "text-bad", bar: "bg-bad" };
}

/** 예전에 저장된 리포트는 headline이 없음 — 근거 첫 문장을 잘라서 대신 보여줌. */
function criterionHeadline(c: InvestmentCriterionAssessment): string {
  if (c.headline) return c.headline;
  const first = c.rationale.split(/(?<=[.다])\s/)[0] ?? c.rationale;
  return first.length > 70 ? `${first.slice(0, 68)}…` : first;
}

function shortLabel(c: InvestmentCriterionAssessment): string {
  return CRITERION_BY_ID[c.criterion]?.shortLabel ?? c.criterionLabel;
}

/** 줄바꿈으로 구분된 개조식 글을 한 줄씩 보여줌. 줄바꿈이 없는 예전 평가의 긴 글은 문장 단위로 나눠 줄로 보여줌. */
function Lines({ text, className = "", bullet = true }: { text: string; className?: string; bullet?: boolean }) {
  let lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1 && text.length > 80) {
    lines = text.split(/(?<=[.다요])\s+/).map((l) => l.trim()).filter(Boolean);
  }
  return (
    <ul className={className}>
      {lines.map((l, i) => (
        <li key={i} className="flex gap-1.5">
          {bullet && <span className="shrink-0 text-muted">·</span>}
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-panel-border bg-panel p-4 ${className}`}>{children}</div>;
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

/** 점수에서 제외된 기준(밸류에이션·재무)은 예전 평가에 남아 있어도 보여주지 않음. */
const HIDDEN_CRITERIA = new Set(["valuationFit", "financialHealth"]);
const visibleCriteria = (criteria: InvestmentCriterionAssessment[]) => criteria.filter((c) => !HIDDEN_CRITERIA.has(c.criterion));

function ScoreHero({ report }: { report: EvaluationReport }) {
  const ia = report.investmentAttractiveness!;
  const overall = ia.overallScore;
  const tone = overall != null ? scoreTone(overall) : null;

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0 text-center">
          <div className={`text-5xl font-bold leading-none ${tone?.text ?? "text-muted"}`}>{overall ?? "—"}</div>
          <p className="mt-1 text-[11px] text-muted">투자 매력도</p>
        </div>
        <div className="min-w-0">
          {ia.verdict && (
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERDICT_STYLES[ia.verdict]}`}>
              {ia.verdict}
            </span>
          )}
          {ia.verdictLine && (
            <p className="mt-1.5 text-base font-bold leading-snug text-foreground">{ia.verdictLine}</p>
          )}
          <Lines
            text={ia.summary}
            className={`space-y-0.5 leading-snug ${ia.verdictLine ? "mt-2 text-sm font-normal text-foreground/80" : "text-[15px] font-semibold text-foreground"}`}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {visibleCriteria(ia.criteria).map((c) => {
          const undeterminable = c.determinable === false;
          const t = scoreTone(c.score);
          return (
            <div key={c.criterion}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted">{shortLabel(c)}</span>
                <span className={`font-semibold ${undeterminable ? "text-muted" : t.text}`}>
                  {undeterminable ? "판단 불가" : (<>{c.score}<span className="ml-0.5 text-xs font-normal text-muted">/100</span></>)}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-foreground/20 ring-1 ring-inset ring-foreground/15">
                {!undeterminable && <div className={`h-1.5 rounded-full ${t.bar}`} style={{ width: `${c.score}%` }} />}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="rounded-full bg-panel px-2 py-0.5 text-foreground">{report.stageAssessment.currentStage} 단계</span>
        <span>자료 충실도 {report.totalScore}/100 (별도 지표)</span>
        <span>기술·트랙션 각 45% · 편중 10% · 판단 불가는 제외하고 계산</span>
      </p>
    </div>
  );
}

function PointList({ points, tone }: { points: CitedPoint[]; tone: "good" | "bad" }) {
  const dot = tone === "good" ? "text-good" : "text-bad";
  if (points.length === 0) return <p className="text-sm text-muted">특별히 짚을 만한 지점이 없어요.</p>;
  return (
    <ul className="space-y-2.5">
      {points.slice(0, 4).map((p, i) => (
        <li key={i} className="text-sm leading-snug">
          <span className={`mr-1.5 ${dot}`}>●</span>
          <span className="font-medium text-foreground">{p.headline ?? p.text}</span>
          <PageBadges pageRefs={p.pageRefs} />
          {p.headline && <Lines text={p.text} bullet={false} className="ml-4 mt-0.5 text-xs text-muted" />}
        </li>
      ))}
    </ul>
  );
}

function NextSteps({ steps, questions }: { steps: ActionItem[]; questions: string[] }) {
  return (
    <Card>
      <SectionTitle hint="이 딜을 진행하려면 대표에게 확인할 것">심사역 다음 액션</SectionTitle>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="mt-0.5 shrink-0 text-xs font-semibold text-muted">{i + 1}</span>
            <div>
              <p className="leading-snug">
                <span className="font-medium text-foreground">{s.title}</span>
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[s.priority]}`}>
                  {s.priority}
                </span>
                <PageBadges pageRefs={s.pageRefs} />
              </p>
              <Lines text={s.detail} bullet={false} className="mt-0.5 text-xs text-muted" />
            </div>
          </li>
        ))}
      </ol>
      {questions.length > 0 && (
        <div className="mt-4 border-t border-panel-border pt-3">
          <p className="mb-1.5 text-xs font-semibold text-muted">대표에게 던질 질문</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-muted">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

function CriteriaDetail({ criteria }: { criteria: InvestmentCriterionAssessment[] }) {
  return (
    <Card>
      <SectionTitle>기준별 판단</SectionTitle>
      <div className="divide-y divide-panel-border">
        {criteria.map((c) => {
          const undeterminable = c.determinable === false;
          const weight = CRITERION_BY_ID[c.criterion]?.weight;
          return (
            <div key={c.criterion} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0 sm:w-36">
                  <p className="text-sm font-semibold text-foreground">{shortLabel(c)}</p>
                  {weight != null && <p className="text-[11px] text-muted">가중치 {weight}%</p>}
                </div>
                <div className="h-3 min-w-0 flex-1 rounded-full bg-foreground/20 ring-1 ring-inset ring-foreground/15">
                  {!undeterminable && (
                    <div className={`h-3 rounded-full ${scoreTone(c.score).bar}`} style={{ width: `${c.score}%` }} />
                  )}
                </div>
                <div className={`w-20 shrink-0 text-right text-2xl font-bold leading-none ${undeterminable ? "text-sm text-muted" : scoreTone(c.score).text}`}>
                  {undeterminable ? "판단 불가" : c.score}
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground/90">{criterionHeadline(c)}</p>
              <div className="mt-1.5 text-xs leading-relaxed text-muted">
                <Lines text={c.rationale} className="space-y-0.5" />
                <PageBadges pageRefs={c.pageRefs} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function InternalReportView({
  report,
  peerPanel,
  details,
}: {
  report: EvaluationReport;
  /** 피어 리서치 패널(평가 id가 있어야 동작하므로 부모가 만들어 넘김). */
  peerPanel: React.ReactNode;
  /** 자료 충실도·산업 적합성·스토리라인 등 상세 분석 — 요약 아래에 이어서 보여줌. */
  details: React.ReactNode;
}) {
  const ia = report.investmentAttractiveness!;

  return (
    <div className="space-y-4">
      {report.companySnapshot && (
        <Lines text={report.companySnapshot} className="space-y-0.5 text-sm leading-snug text-foreground/90" />
      )}

      <ScoreHero report={report} />

      {report.financials && <FinancialsCard financials={report.financials} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-good/30 bg-good/5">
          <SectionTitle>👍 긍정 요인</SectionTitle>
          <PointList points={ia.strongPoints} tone="good" />
        </Card>
        <Card className="border-bad/30 bg-bad/5">
          <SectionTitle>🚩 우려 요인</SectionTitle>
          <PointList points={ia.concerns} tone="bad" />
        </Card>
      </div>

      {ia.reviewerNextSteps?.length > 0 && <NextSteps steps={ia.reviewerNextSteps} questions={report.reviewerQuestions ?? []} />}

      <CriteriaDetail criteria={visibleCriteria(ia.criteria)} />

      {peerPanel}

      <div className="space-y-5 border-t border-panel-border pt-5">
        <p className="text-xs font-semibold text-muted">상세 분석 — 자료 충실도 · 산업 적합성</p>
        {details}
      </div>
    </div>
  );
}
