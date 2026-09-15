"use client";

import { useState } from "react";
import type { EvaluationReport } from "@/lib/reportSchema";
import { RadarScoreChart } from "./RadarScoreChart";
import { StageFitBar } from "./StageFitBar";
import { StrengthsImprovements } from "./StrengthsImprovements";
import { IndustryFitPanel } from "./IndustryFitPanel";
import { InvestmentAttractivenessPanel } from "./InvestmentAttractivenessPanel";
import { StorylineTimeline } from "./StorylineTimeline";
import { ActionPlanList } from "./ActionPlanList";
import { ReviewerQuestions } from "./ReviewerQuestions";
import { PeerResearchPlaceholder } from "./PeerResearchPlaceholder";

const EMAIL_GATE_SCORE = 80;

function CategoryDetail({ categoryScores }: { categoryScores: EvaluationReport["categoryScores"] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5">
      <h3 className="mb-1 font-semibold">영역별 상세</h3>
      <p className="mb-4 text-xs text-muted">5개 영역의 IR 자료 충실도 점수와 각 영역이 보는 항목</p>
      <div className="space-y-3">
        {categoryScores.map((c) => {
          const barColor = c.score >= 60 ? "bg-warn" : c.score >= 40 ? "bg-warn/70" : "bg-bad";
          const isOpen = open === c.category;
          return (
            <div key={c.category}>
              <button
                onClick={() => setOpen(isOpen ? null : c.category)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-medium">
                  {isOpen ? "▾" : "▸"} {c.categoryLabel}
                </span>
                <span className="flex items-center gap-3 text-xs text-muted">
                  <span>충족 {c.satisfied} · 부분 {c.partial} · 미충족 {c.unmet}</span>
                  <span className="font-semibold text-foreground">{c.score}</span>
                </span>
              </button>
              <div className="mt-1 h-1.5 w-full rounded-full bg-white/10">
                <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${c.score}%` }} />
              </div>
              {isOpen && <p className="mt-2 text-sm text-muted">{c.summary}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResultReport({
  report,
  reviewerName,
  reviewerAffiliation,
  onReset,
  internalMode = false,
}: {
  report: EvaluationReport;
  reviewerName: string;
  reviewerAffiliation: string;
  onReset: () => void;
  internalMode?: boolean;
}) {
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const eligible = report.totalScore >= EMAIL_GATE_SCORE;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-panel-border bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-soft">
              {report.verdictTag}
            </span>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground">{report.verdictSummary}</p>
            <p className="mt-2 text-xs text-muted">IR 자료 충실도 점수 (투자 판단 아님)</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-accent-soft">
              {report.totalScore}
              <span className="text-lg text-muted">/100</span>
            </div>
            <p className="text-xs text-muted">종합 점수</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-panel-border bg-panel p-5">
        <RadarScoreChart categoryScores={report.categoryScores} />
      </div>

      <StageFitBar stageAssessment={report.stageAssessment} />
      <StrengthsImprovements strengths={report.strengths} improvements={report.improvements} />
      <IndustryFitPanel industryFit={report.industryFit} />
      {report.investmentAttractiveness && (
        <InvestmentAttractivenessPanel investmentAttractiveness={report.investmentAttractiveness} />
      )}
      <CategoryDetail categoryScores={report.categoryScores} />
      <StorylineTimeline storyline={report.storyline} />
      <PeerResearchPlaceholder />
      <ActionPlanList actionPlan={report.actionPlan} />
      <ReviewerQuestions questions={report.reviewerQuestions} />

      {!internalMode && (
        <div className="rounded-lg border border-panel-border bg-panel p-5">
          {eligible ? (
            <>
              <button
                onClick={() => setEmailSent(`${reviewerName} (${reviewerAffiliation}) 심사역님께 전달 준비가 완료되었습니다.`)}
                className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent-soft"
              >
                이 심사역에게 메일로 IR 보내기
              </button>
              {emailSent && (
                <p className="mt-2 text-center text-sm text-good">
                  {emailSent} (데모 버전에서는 실제로 발송되지 않습니다.)
                </p>
              )}
            </>
          ) : (
            <div className="rounded-md border border-warn/30 bg-warn/10 p-4 text-sm text-warn">
              <p className="font-medium">{EMAIL_GATE_SCORE}점을 넘겨야만 해당 심사역에게 메일을 보낼 수 있어요.</p>
              <p className="mt-1 text-warn/80">
                현재 종합 점수는 {report.totalScore}점이에요 (기준 {EMAIL_GATE_SCORE}점). Action Plan을 수행해서 점수를
                올려보세요!
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full rounded-lg border border-panel-border py-3 text-sm text-muted transition hover:border-accent-soft/60 hover:text-foreground"
      >
        다시 평가하기
      </button>
    </div>
  );
}
