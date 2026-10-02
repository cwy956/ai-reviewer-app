export type InvestmentStage = "Seed" | "Pre-A" | "Series A" | "Series B+";

export interface CitedPoint {
  /** Short, scannable label (~10~20자) — the thing a reviewer skimming the page should catch in
   * under a second. Optional only because reports saved before this field existed won't have it;
   * every newly generated report includes it. */
  headline?: string;
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
  /** Internal-only — what the reviewer (not the startup) should do next, e.g. "call the founder
   * and ask about X". Distinct from actionPlan, which is deck-improvement advice for the startup. */
  reviewerNextSteps: ActionItem[];
}

/**
 * Computed programmatically from the PDF's per-page extracted text (never by the model) right
 * after parsing, and attached to the report before it's saved — a deck where most pages failed
 * text extraction (scanned images, broken fonts, etc.) gets scored the same way as a fully
 * readable one otherwise, with no signal that the score itself rests on thin material.
 */
export interface ExtractionQuality {
  pageCount: number;
  emptyPageCount: number;
  emptyPageRatio: number;
  lowConfidence: boolean;
}

/** Peer companies found via live web search, for a VC comparing this deal against the market —
 * run on demand (not on every evaluation) since it needs its own web-search round trip. */
export interface PeerCompany {
  name: string;
  description: string;
  comparisonNote: string;
  url: string | null;
}

export interface PeerResearchResult {
  summary: string;
  peers: PeerCompany[];
  researchedAt: string;
}

export interface EvaluationReport {
  /** Extracted from the IR material itself — the deal list shouldn't have to fall back to a raw
   * email subject line ("마이 오 마이 투자문의드립니다.") when the deck already states the name. */
  companyName?: string;
  /** ~10~15자 짧은 한 줄 — 딜 목록에서 "회사명 | 태그라인" 형태로 쓰임. */
  companyTagline?: string;
  /** 영역 안에서 이 회사가 속한 세부 영역(예: "전력반도체(SiC·GaN)"). 모델이 자료를 보고 고름. */
  subDomain?: string;
  /** The very first thing a reviewer reads — 2~3 plain-language sentences on what this company
   * actually does, before any scoring. Optional only for reports saved before this field existed. */
  companySnapshot?: string;
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
  /** Attached programmatically after parsing, not by the model — see ExtractionQuality. */
  extractionQuality?: ExtractionQuality;
  /** Filled in on demand via a separate web-search call, not part of the initial evaluation. */
  peerResearch?: PeerResearchResult;
}
