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

/**
 * Internal-only axis (never shown to the startup on the public page). Unlike industryFit,
 * this one is explicitly allowed to judge investment attractiveness — it's for our own
 * reviewers deciding whether to pursue a deal, not documentation feedback for the founder.
 * Criteria are a placeholder starter set; expected to be recalibrated once real 투심보고서
 * examples are available to learn what 안다아시아벤처스 actually weighs.
 */
export interface InvestmentCriterionAssessment {
  criterion: "market" | "competitiveAdvantage" | "teamExecution" | "traction" | "valuationFit";
  criterionLabel: string;
  score: number;
  rationale: string;
  pageRefs: number[];
}

export interface InvestmentAttractivenessAssessment {
  overallScore: number;
  summary: string;
  criteria: InvestmentCriterionAssessment[];
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
  investmentAttractiveness?: InvestmentAttractivenessAssessment;
  storyline: StorylineStep[];
  actionPlan: ActionItem[];
  reviewerQuestions: string[];
}
