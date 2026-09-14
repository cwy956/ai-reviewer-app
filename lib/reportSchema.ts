export type InvestmentStage = "Seed" | "Pre-A" | "Series A" | "Series B+";

export interface CitedPoint {
  text: string;
  pageRefs: number[];
}

export interface ActionItem {
  title: string;
  detail: string;
  pageRefs: number[];
  priority: "높음" | "중간" | "낮음";
}

export interface CategoryScore {
  category: "team" | "market" | "product" | "traction" | "finance";
  categoryLabel: string;
  score: number;
  satisfied: number;
  partial: number;
  unmet: number;
  summary: string;
}

export interface StorylineStep {
  title: string;
  detail: string;
}

/**
 * A separate axis from totalScore/categoryScores (which measure IR 자료 완성도 — did the
 * material include the expected information). This measures whether the claims IN that
 * material hold up against the domain's usual competitive/technical/financial patterns —
 * still framed as "근거의 산업적 타당성", never as investment attractiveness or a buy/pass call.
 */
export interface IndustryFitAssessment {
  summary: string;
  strongPoints: CitedPoint[];
  concerns: CitedPoint[];
}

export interface EvaluationReport {
  totalScore: number;
  verdictTag: string;
  verdictSummary: string;
  stageAssessment: {
    currentStage: InvestmentStage;
    rationale: string;
    nextStepAdvice: string;
  };
  categoryScores: CategoryScore[];
  strengths: CitedPoint[];
  improvements: CitedPoint[];
  industryFit: IndustryFitAssessment;
  storyline: StorylineStep[];
  actionPlan: ActionItem[];
  reviewerQuestions: string[];
}
