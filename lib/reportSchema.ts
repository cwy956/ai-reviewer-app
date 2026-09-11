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
  storyline: StorylineStep[];
  actionPlan: ActionItem[];
  reviewerQuestions: string[];
}
