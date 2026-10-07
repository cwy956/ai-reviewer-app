"use client";

import { useState } from "react";
import type { ActionItem, CitedPoint, EvaluationReport, InvestmentCriterionAssessment } from "@/lib/reportSchema";
import { CRITERION_BY_ID } from "@/lib/investmentCriteria";
import { PageBadges } from "./StrengthsImprovements";

const PRIORITY_STYLES: Record<ActionItem["priority"], string> = {
  높음: "bg-bad/15 text-bad",
  중간: "bg-warn/15 text-warn",
  낮음: "bg-black/5 text-muted",
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
  return first.length > 60 ? `${first.slice(0, 58)}…` : first;
}

function shortLabel(c: InvestmentCriterionAssessment): string {
  return CRITERION_BY_ID[c.criterion]?.shortLabel ?? c.criterionLabel;
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
        <p className="text-sm font-medium leading-relaxed text-foreground">{ia.summary}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        {ia.criteria.map((c) => {
          const undeterminable = c.determinable === false;
          const t = scoreTone(c.score);
          return (
            <div key={c.criterion}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted">{shortLabel(c)}</span>
                <span className={`font-semibold ${undeterminable ? "text-muted" : t.text}`}>
                  {undeterminable ? "판단 불가" : c.score}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-panel-border">
                {!undeterminable && <div className={`h-1.5 rounded-full ${t.bar}`} style={{ width: `${c.score}%` }} />}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="rounded-full bg-panel px-2 py-0.5 text-foreground">{report.stageAssessment.currentStage} 단계</span>
        <span>자료 충실도 {report.totalScore}/100 (별도 지표)</span>
        <span>기술·트랙션 각 40% · 편중·밸류 각 10% · 판단 불가는 제외하고 계산</span>
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
          {p.headline && <p className="ml-4 mt-0.5 text-xs text-muted">{p.text}</p>}
        </li>
      ))}
    </ul>
  );
}

function NextSteps({ steps, questions }: { steps: ActionItem[]; questions: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? steps : steps.slice(0, 3);
  const hasMore = steps.length > 3 || questions.length > 0;
  return (
    <Card>
      <SectionTitle hint="이 딜을 진행하려면 대표에게 확인할 것">심사역 다음 액션</SectionTitle>
      <ol className="space-y-2.5">
        {visible.map((s, i) => (
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
              <p className="mt-0.5 text-xs text-muted">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      {expanded && questions.length > 0 && (
        <div className="mt-4 border-t border-panel-border pt-3">
          <p className="mb-1.5 text-xs font-semibold text-muted">대표에게 던질 질문</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-muted">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
      {hasMore && (
        <button onClick={() => setExpanded(!expanded)} className="mt-3 text-xs text-accent-soft hover:underline">
          {expanded
            ? "접기"
            : `더 보기${steps.length > 3 ? ` (+${steps.length - 3})` : ""}${questions.length > 0 ? ` · 질문 ${questions.length}개` : ""}`}
        </button>
      )}
    </Card>
  );
}

function CriteriaDetail({ criteria }: { criteria: InvestmentCriterionAssessment[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      <SectionTitle hint="눌러서 근거 보기">기준별 판단</SectionTitle>
      <div className="divide-y divide-panel-border">
        {criteria.map((c) => {
          const isOpen = open === c.criterion;
          const undeterminable = c.determinable === false;
          const weight = CRITERION_BY_ID[c.criterion]?.weight;
          return (
            <div key={c.criterion} className="py-2.5 first:pt-0 last:pb-0">
              <button onClick={() => setOpen(isOpen ? null : c.criterion)} className="flex w-full items-start gap-2 text-left">
                <span className="mt-0.5 text-xs text-muted">{isOpen ? "▾" : "▸"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium text-foreground">{shortLabel(c)}</span>
                    {weight != null && <span className="ml-1.5 text-[11px] text-muted">{weight}%</span>}
                    <span className="ml-2 text-xs text-muted">{undeterminable ? "판단 불가" : `${c.score}점`}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{undeterminable ? c.rationale : criterionHeadline(c)}</p>
                </div>
              </button>
              {isOpen && !undeterminable && (
                <p className="ml-5 mt-2 text-xs leading-relaxed text-muted">
                  {c.rationale}
                  <PageBadges pageRefs={c.pageRefs} />
                </p>
              )}
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
  /** 접어 둘 상세 분석(충실도·산업 적합성·스토리라인 등). */
  details: React.ReactNode;
}) {
  const ia = report.investmentAttractiveness!;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4">
      {report.companySnapshot && <p className="text-sm leading-relaxed text-foreground/90">{report.companySnapshot}</p>}

      <ScoreHero report={report} />

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

      <CriteriaDetail criteria={ia.criteria} />

      {peerPanel}

      <div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full rounded-lg border border-panel-border py-2.5 text-sm text-muted transition hover:border-accent-soft/60 hover:text-foreground"
        >
          {showDetails ? "상세 분석 접기 ▴" : "상세 분석 더 보기 (자료 충실도 · 산업 적합성 · 스토리라인) ▾"}
        </button>
        {showDetails && <div className="mt-4 space-y-5">{details}</div>}
      </div>
    </div>
  );
}
