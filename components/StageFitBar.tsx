import type { EvaluationReport, InvestmentStage } from "@/lib/reportSchema";

const STAGES: InvestmentStage[] = ["Seed", "Pre-A", "Series A", "Series B+"];

export function StageFitBar({ stageAssessment }: { stageAssessment: EvaluationReport["stageAssessment"] }) {
  const currentIdx = STAGES.indexOf(stageAssessment.currentStage);

  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">단계 적합도 진단</h3>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-soft">
          {stageAssessment.currentStage} 적합
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {STAGES.map((stage, i) => (
          <div key={stage} className="space-y-1">
            <div className={`h-1.5 rounded-full ${i <= currentIdx ? "bg-accent" : "bg-white/10"}`} />
            <p className={`text-center text-xs ${i === currentIdx ? "font-semibold text-foreground" : "text-muted"}`}>
              {stage}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted">{stageAssessment.rationale}</p>

      <div className="mt-3 rounded-md bg-white/5 p-3 text-sm">
        <p className="mb-1 font-medium text-accent-soft">다음 단계로 가려면</p>
        <p className="text-muted">{stageAssessment.nextStepAdvice}</p>
      </div>
    </div>
  );
}
