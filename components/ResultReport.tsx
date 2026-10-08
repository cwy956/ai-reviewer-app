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
import { PeerResearchPanel } from "./PeerResearchPanel";
import { InternalReportView } from "./InternalReportView";
import { sanitizeReport } from "@/lib/sanitizeReport";


function CompanySnapshotCard({ companySnapshot }: { companySnapshot?: string }) {
  if (!companySnapshot) return null;
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">한눈에 보기</p>
      <p className="text-base font-medium leading-relaxed text-foreground">{companySnapshot}</p>
    </div>
  );
}

/** 투자기업이 받는 결과 맨 위의 피드백 요약 — 보완하면 좋은 점과 우선 할 일을 먼저 보여줌 (투자 매력도는 내부 전용이라 없음) */
function CompanyFeedbackSummary({ report }: { report: EvaluationReport }) {
  const improvements = (report.improvements ?? []).slice(0, 3);
  const order = { 높음: 0, 중간: 1, 낮음: 2 } as const;
  const actions = [...(report.actionPlan ?? [])].sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 3);
  if (improvements.length === 0 && actions.length === 0) return null;
  return (
    <div className="rounded-lg border border-accent/30 bg-accent-tint/40 p-5">
      <p className="text-sm font-semibold text-accent-soft">AI 심사역 피드백</p>
      <p className="mt-0.5 text-xs text-muted">제출하신 IR을 이렇게 보완하면 심사역이 검토하기 더 좋아요.</p>
      {improvements.length > 0 && (
        <ul className="mt-3 space-y-2">
          {improvements.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-0.5 text-accent-soft">●</span>
              <span>
                <span className="font-medium text-foreground">{p.headline ?? p.text}</span>
                {p.headline && <span className="mt-0.5 block text-xs text-muted">{p.text}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {actions.length > 0 && (
        <div className="mt-4 border-t border-accent/20 pt-3">
          <p className="mb-1.5 text-xs font-semibold text-muted">먼저 해보면 좋은 보완</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {actions.map((a, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{a.title}</span>
                <span className="block text-xs text-muted">{a.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ExtractionQualityBanner({ extractionQuality }: { extractionQuality: EvaluationReport["extractionQuality"] }) {
  if (!extractionQuality?.lowConfidence) return null;
  const pct = Math.round(extractionQuality.emptyPageRatio * 100);
  return (
    <div className="rounded-lg border border-bad/30 bg-bad/5 p-4 text-sm text-bad">
      <p className="font-medium">⚠ 자료 추출 불완전 — 점수 신뢰도 낮음</p>
      <p className="mt-1 text-bad/80">
        전체 {extractionQuality.pageCount}페이지 중 {extractionQuality.emptyPageCount}페이지({pct}%)에서 텍스트를
        추출하지 못했어요(스캔 이미지이거나 폰트가 깨진 자료일 수 있어요). 아래 점수는 실제보다 낮게 나왔을 수 있으니
        원문을 직접 확인해보세요.
      </p>
    </div>
  );
}

function Hero({ report, internalMode }: { report: EvaluationReport; internalMode: boolean }) {
  const ia = report.investmentAttractiveness;
  // 내부용이고 투자 매력도가 있으면 그 점수를 헤드라인으로 — 심사역이 가장 먼저 보고 싶어하는
  // 숫자는 "자료가 체크리스트를 얼마나 채웠는지"가 아니라 "이 딜이 얼마나 매력적인지"라서.
  if (internalMode && ia) {
    return (
      <div className="rounded-lg border border-accent/40 bg-accent/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-soft">
              투자 매력도 진단 (내부 전용)
            </span>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground">{ia.summary}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full bg-panel px-2 py-0.5">{report.verdictTag}</span>
              <span>자료 충실도 {report.totalScore}/100 (별도 지표)</span>
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-accent-soft">
              {ia.overallScore ?? "—"}
              {ia.overallScore != null && <span className="text-lg text-muted">/100</span>}
            </div>
            <p className="text-xs text-muted">투자 매력도</p>
          </div>
        </div>
      </div>
    );
  }

  return (
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
  );
}

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
              <div className="mt-1 h-1.5 w-full rounded-full bg-panel-border">
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
  report: rawReport,
  reviewerAffiliation,
  onReset,
  internalMode = false,
  evaluationId,
  dealTitle,
  domainLabel,
}: {
  report: EvaluationReport;
  reviewerAffiliation: string;
  /** 없으면 하단 "다시 평가하기" 버튼을 그리지 않음(재평가 불가능한 곳용). */
  onReset?: () => void;
  internalMode?: boolean;
  /** Needed only for the on-demand peer-research panel — omit to fall back to the placeholder. */
  evaluationId?: number;
  dealTitle?: string;
  domainLabel?: string;
}) {
  const report = sanitizeReport(rawReport);
  const peerPanel =
    internalMode && evaluationId && dealTitle && domainLabel ? (
      <PeerResearchPanel
        evaluationId={evaluationId}
        dealTitle={dealTitle}
        domainLabel={domainLabel}
        initial={report.peerResearch}
      />
    ) : (
      <PeerResearchPlaceholder />
    );

  // 내부 심사역용: 결론·점수·핵심 요인·할 일을 먼저, 나머지 상세는 접어서 보여줌
  if (internalMode && report.investmentAttractiveness) {
    return (
      <div className="space-y-5">
        <ExtractionQualityBanner extractionQuality={report.extractionQuality} />
        <InternalReportView
          report={report}
          peerPanel={peerPanel}
          details={
            <>
              <div className="rounded-lg border border-panel-border bg-panel p-5">
                <RadarScoreChart categoryScores={report.categoryScores} />
              </div>
              <StageFitBar stageAssessment={report.stageAssessment} />
              <StrengthsImprovements strengths={report.strengths} improvements={report.improvements} />
              <IndustryFitPanel industryFit={report.industryFit} />
              <CategoryDetail categoryScores={report.categoryScores} />
            </>
          }
        />
        {onReset && (
          <button
            onClick={onReset}
            className="w-full rounded-lg border border-panel-border py-3 text-sm text-muted transition hover:border-accent-soft/60 hover:text-foreground"
          >
            다시 평가하기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CompanySnapshotCard companySnapshot={report.companySnapshot} />
      <Hero report={report} internalMode={internalMode} />
      <ExtractionQualityBanner extractionQuality={report.extractionQuality} />
      {!internalMode && <CompanyFeedbackSummary report={report} />}

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
      {internalMode && evaluationId && dealTitle && domainLabel ? (
        <PeerResearchPanel
          evaluationId={evaluationId}
          dealTitle={dealTitle}
          domainLabel={domainLabel}
          initial={report.peerResearch}
        />
      ) : (
        <PeerResearchPlaceholder />
      )}
      <ActionPlanList
        actionPlan={report.actionPlan}
        title="Action Plan (자료 보강)"
        subtitle="점수 향상을 위한 다음 단계 · 스타트업 참고용 · 우선순위순"
      />
      {internalMode && report.investmentAttractiveness && report.investmentAttractiveness.reviewerNextSteps?.length > 0 && (
        <ActionPlanList
          actionPlan={report.investmentAttractiveness.reviewerNextSteps}
          title="심사역 다음 액션"
          subtitle="이 딜을 더 진행하기 위해 지금 할 수 있는 일 · 내부 전용"
        />
      )}
      <ReviewerQuestions questions={report.reviewerQuestions} />

      {!internalMode && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-5 text-center">
          <p className="font-semibold text-accent-soft">제출이 완료되었어요</p>
          <p className="mt-1 text-sm text-muted">
            {reviewerAffiliation} 심사역이 제출하신 IR을 직접 검토합니다. 투자 논의가 필요하다고 판단되면 연락드릴게요.
          </p>
        </div>
      )}

      {onReset && (
        <button
          onClick={onReset}
          className="w-full rounded-lg border border-panel-border py-3 text-sm text-muted transition hover:border-accent-soft/60 hover:text-foreground"
        >
          다시 평가하기
        </button>
      )}
    </div>
  );
}
