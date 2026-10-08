import Anthropic from "@anthropic-ai/sdk";
import type { Domain } from "./domains";
import { CATEGORY_LABELS } from "./domains";
import type { Persona } from "./personas/schema";
import { buildSystemPrompt, buildUserMessage, type DealInfo } from "./buildPrompt";
import type { EvaluationReport, InvestmentAttractivenessAssessment } from "./reportSchema";
import { sanitizeReport } from "./sanitizeReport";
import { INVESTMENT_CRITERIA, CHECK_VERDICTS, computeWeightedScore, calibrateScore, composeVerdict } from "./investmentCriteria";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const CITED_POINT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: {
      type: "string",
      description: "10~20자 내외의 짧고 핵심적인 라벨. 이것만 읽어도 무슨 내용인지 바로 파악돼야 함 (예: '팀 정보 전무', '3년 연속 매출 2배 성장').",
    },
    text: { type: "string", description: "headline을 뒷받침하는 1문장 부연 설명" },
    pageRefs: { type: "array", items: { type: "integer" } },
  },
  required: ["headline", "text", "pageRefs"],
} as const;

const ACTION_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    detail: { type: "string" },
    pageRefs: { type: "array", items: { type: "integer" } },
    priority: { type: "string", enum: ["높음", "중간", "낮음"] },
  },
  required: ["title", "detail", "pageRefs", "priority"],
} as const;

const INVESTMENT_ATTRACTIVENESS_SCHEMA: Anthropic.Tool["input_schema"] = {
  type: "object",
  description:
    "내부 심사역 전용 투자 매력도 진단. industryFit/categoryScores와 달리 투자 판단 언어를 명시적으로 허용함.",
  additionalProperties: false,
  properties: {
    verdictReason: {
      type: "string",
      description: "이 딜의 투자 관점 핵심 이유 한 줄(35자 이내, 명사형 개조식). 예: 대기업 레퍼런스·수주 실적 다수",
    },
    confirmItem: {
      type: "string",
      description: "투자 검토를 확정하려면 가장 먼저 확인해야 할 핵심 사항 하나(30자 이내 명사구, 문장 아님). 예: 수주 86억 중 확정 계약분. 확인할 게 특별히 없으면 빈 문자열",
    },
    summary: { type: "string", description: "결론을 뒷받침하는 핵심 근거 개조식 2~3줄(줄바꿈 구분). 결론 문구는 반복하지 말 것" },
    criteria: {
      type: "array",
      description: "정확히 3개 원소 (techAdvantage, tractionCertainty, concentrationRisk 각 1개씩). checks는 항상 빈 배열.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          criterion: {
            type: "string",
            enum: INVESTMENT_CRITERIA.map((c) => c.id),
          },
          criterionLabel: { type: "string" },
          score: { type: "integer", description: "0~100. determinable이 false면 0으로 둠(종합에서 제외됨)" },
          headline: { type: "string", description: "이 기준의 판단 핵심을 한 줄로 (35자 이내, 예: 대기업 레퍼런스 다수, 계약 세부는 불명)" },
          determinable: {
            type: "boolean",
            description: "IR(과 산업 일반지식)만으로 이 기준을 판단할 수 있으면 true. 판단할 정보가 아예 없으면 false.",
          },
          rationale: { type: "string" },
          pageRefs: { type: "array", items: { type: "integer" } },
          checks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", description: "세부 질문 id (D1-1~D1-8 또는 D2-1~D2-8)" },
                verdict: { type: "string", enum: [...CHECK_VERDICTS] },
                evidence: { type: "string", description: "판정 근거 1~2문장 — IR의 구체적 수치·고객명·문구를 인용" },
                pageRefs: { type: "array", items: { type: "integer" } },
              },
              required: ["id", "verdict", "evidence", "pageRefs"],
            },
          },
        },
        required: ["criterion", "criterionLabel", "score", "headline", "determinable", "rationale", "pageRefs", "checks"],
      },
    },
    strongPoints: { type: "array", items: CITED_POINT_SCHEMA },
    concerns: { type: "array", items: CITED_POINT_SCHEMA },
    reviewerNextSteps: {
      type: "array",
      description: "심사역이 직접 취할 다음 행동 3~5개 (자료 보강 조언이 아님 — actionPlan과 역할이 다름)",
      items: ACTION_ITEM_SCHEMA,
    },
  },
  required: ["verdictReason", "confirmItem", "summary", "criteria", "strongPoints", "concerns", "reviewerNextSteps"],
};

const INVESTMENT_TOOL: Anthropic.Tool = {
  name: "submit_investment_attractiveness",
  description: "내부 심사역 전용 투자 매력도 진단을 구조화된 형태로 제출합니다.",
  strict: true,
  input_schema: INVESTMENT_ATTRACTIVENESS_SCHEMA,
};

function buildReportTool(mode: "external" | "internal", includeStoryline = false): Anthropic.Tool {
  const properties: Record<string, unknown> = {
      companyName: {
        type: "string",
        description:
          "IR 자료에 명시된 회사/브랜드의 실제 이름 (이메일 제목이 아니라 자료 본문·표지에서 찾을 것). 자료 어디에도 이름이 없으면 빈 문자열로 두세요.",
      },
      subDomain: {
        type: "string",
        description:
          "시스템 프롬프트의 '세부 영역 후보' 중 이 회사에 가장 가까운 것 하나(후보 라벨 그대로). 후보가 없거나 맞는 게 없으면 빈 문자열.",
      },
      companyTagline: {
        type: "string",
        description:
          "10~15자 내외로 이 회사가 뭘 하는지 핵심만 (예: '비건 뷰티 브랜드 운영', '해상풍력 발전플랜트 기술 개발'). 딜 목록에 '회사명 | 태그라인' 형태로 노출됩니다.",
      },
      companySnapshot: {
        type: "string",
        description:
          "이 회사가 무엇을 하는 회사인지 개조식 2줄(줄바꿈 구분, 한 줄 45자 안팎, 명사형 종결)로 설명 — 1줄: 무엇을·누구에게 제공하는 회사인지, 2줄: 설립연도·투자 단계 등 현황 (업종, 핵심 제품/서비스, 타깃 고객, 현재 단계). 심사역이 점수나 분석을 보기 전에 가장 먼저 읽는 문장이므로 전문용어 없이 평이하게 쓰세요. 자료가 부실해도 확인 가능한 선에서 사실 기반으로 작성하고, 추정이면 '~로 추정됨'이라고 밝히세요.",
      },
      totalScore: { type: "integer", description: "0에서 100 사이의 점수" },
      verdictTag: { type: "string", description: "예: 'Pre-A 적합'" },
      verdictSummary: { type: "string", description: "한 줄 총평" },
      stageAssessment: {
        type: "object",
        additionalProperties: false,
        properties: {
          currentStage: { type: "string", enum: ["Seed", "Pre-A", "Series A", "Series B+"] },
          rationale: { type: "string" },
          nextStepAdvice: { type: "string" },
        },
        required: ["currentStage", "rationale", "nextStepAdvice"],
      },
      categoryScores: {
        type: "array",
        description:
          "정확히 5개 원소를 가진 배열이어야 합니다 (team, market, product, traction, finance 각 1개씩). 객체(map) 형태로 반환하지 마세요.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            category: { type: "string", enum: ["team", "market", "product", "traction", "finance"] },
            categoryLabel: { type: "string" },
            score: { type: "integer", description: "0에서 100 사이의 점수" },
            satisfied: { type: "integer" },
            partial: { type: "integer" },
            unmet: { type: "integer" },
            summary: { type: "string" },
          },
          required: ["category", "categoryLabel", "score", "satisfied", "partial", "unmet", "summary"],
        },
      },
      strengths: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            pageRefs: { type: "array", items: { type: "integer" } },
          },
          required: ["text", "pageRefs"],
        },
      },
      improvements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            pageRefs: { type: "array", items: { type: "integer" } },
          },
          required: ["text", "pageRefs"],
        },
      },
      industryFit: {
        type: "object",
        description:
          "자료 완성도(categoryScores)와는 별개 축. 자료 속 주장이 이 산업의 통상적 경쟁·기술·자본 패턴에 비추어 근거가 탄탄한지 진단. 투자 매력도나 투자 여부 판단이 아님.",
        additionalProperties: false,
        properties: {
          summary: { type: "string", description: "산업 적합성 관점 한 줄 총평" },
          strongPoints: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                pageRefs: { type: "array", items: { type: "integer" } },
              },
              required: ["text", "pageRefs"],
            },
          },
          concerns: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                pageRefs: { type: "array", items: { type: "integer" } },
              },
              required: ["text", "pageRefs"],
            },
          },
        },
        required: ["summary", "strongPoints", "concerns"],
      },
      storyline: {
        type: "array",
        description: "문제정의→해결책→시장기회→기술검증→트랙션→다음단계 순 6단계",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
          },
          required: ["title", "detail"],
        },
      },
      actionPlan: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
            pageRefs: { type: "array", items: { type: "integer" } },
            priority: { type: "string", enum: ["높음", "중간", "낮음"] },
          },
          required: ["title", "detail", "pageRefs", "priority"],
        },
      },
      reviewerQuestions: {
        type: "array",
        items: { type: "string" },
      },
  };

  // 강점·보강 포인트는 headline+text 구조여야 함. 예전엔 {text, pageRefs}만 있어서 모델이 text 안에
  // headline/text 라벨을 통째로 text에 넣는 문제가 있었음 — 헤드라인 필드를 스키마에 명시.
  properties.strengths = { type: "array", items: CITED_POINT_SCHEMA };
  properties.improvements = { type: "array", items: CITED_POINT_SCHEMA };
  const industryFitSchema = properties.industryFit as { properties: Record<string, unknown> };
  industryFitSchema.properties.strongPoints = { type: "array", items: CITED_POINT_SCHEMA };
  industryFitSchema.properties.concerns = { type: "array", items: CITED_POINT_SCHEMA };

  // 스토리라인(회사를 소개하는 흐름)은 스타트업용 피드백이라 내부 심사역 평가에서는 생성하지 않음
  if (mode === "internal" && !includeStoryline) delete properties.storyline;

  const required = [
    "companyName",
    "companyTagline",
    "subDomain",
    "companySnapshot",
    "totalScore",
    "verdictTag",
    "verdictSummary",
    "stageAssessment",
    "categoryScores",
    "strengths",
    "improvements",
    "industryFit",
    "actionPlan",
    "reviewerQuestions",
  ];

  if (mode === "external" || includeStoryline) required.splice(required.indexOf("actionPlan"), 0, "storyline");

  return {
    name: "submit_report",
    description: "IR 평가 결과를 구조화된 형태로 제출합니다.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties,
      required,
    },
  };
}

function normalizeCategoryScores(value: unknown): EvaluationReport["categoryScores"] {
  if (Array.isArray(value)) return value as EvaluationReport["categoryScores"];
  if (value && typeof value === "object") {
    // Model occasionally returns a {team: {...}, market: {...}} map instead of an array — recover it.
    return Object.entries(value as Record<string, unknown>).map(([category, v]) => ({
      category,
      ...(v as object),
    })) as EvaluationReport["categoryScores"];
  }
  throw new Error("categoryScores가 배열 형태로 반환되지 않았습니다.");
}

function fillCategoryLabels(report: EvaluationReport): EvaluationReport {
  const categoryScores = normalizeCategoryScores(report.categoryScores);
  return {
    ...report,
    categoryScores: categoryScores.map((c) => ({
      ...c,
      categoryLabel: c.categoryLabel || CATEGORY_LABELS[c.category],
    })),
  };
}

export interface EvaluateOptions {
  /** 내부 모드에서도 스토리라인(기업용 피드백 화면에 쓰임)을 생성 — 플랫폼 제출 건이 씀. */
  includeStoryline?: boolean;
  /** 투자 매력도 평가를 이 호출에서 하지 않음 — 응답을 먼저 주고 evaluateInvestment를 따로 돌릴 때 사용. */
  skipInvestment?: boolean;
}

// Two separate strict tool calls instead of one combined schema. investmentAttractiveness
// used to be merged into submit_report's schema, but that pushed the strict-mode constrained
// grammar over Anthropic's compilation size limit ("compiled grammar is too large" 400 —
// deterministic, so retrying the combined call never helped). Splitting keeps each schema
// small enough for strict mode, which non-strict mode couldn't reliably replace: without it,
// the model garbled nested fields (e.g. dumped raw tool-call syntax into a string field).
function makeToolRunner(persona: Persona, domain: Domain, markedText: string, dealInfo: DealInfo) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env.local을 확인하세요.");
  }
  const client = new Anthropic({ apiKey });
  const system = buildSystemPrompt(persona, domain, "internal");
  const userMessage = buildUserMessage(markedText, dealInfo);

  return async function runToolCall<T>(tool: Anthropic.Tool, systemOverride?: string, validate?: (v: T) => boolean): Promise<T> {
    const attempt = async (): Promise<T> => {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: systemOverride ?? system,
        messages: [{ role: "user", content: userMessage }],
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      });
      // 비용 점검용 — 평가 한 번이 실제로 쓴 토큰을 로그에 남김 (Vercel 로그에서 확인)
      console.log(`[usage] ${tool.name} model=${MODEL} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
      const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
      if (!toolUse) {
        throw new Error("모델이 구조화된 결과를 반환하지 않았습니다.");
      }
      const result = toolUse.input as T;
      if (validate && !validate(result)) throw new Error("모델 결과가 기대 형식(기준 3개)을 충족하지 않습니다.");
      return result;
    };

    try {
      return await attempt();
    } catch (err) {
      console.error(`evaluateIr ${tool.name} 첫 시도 실패, 재시도:`, err);
      return await attempt();
    }
  };
}

/** 투자 매력도 진단 — 내부 심사역 전용. 실패하면 undefined(기본 리포트는 이미 성공했으니 버리지 않음). */
export async function evaluateInvestment(
  persona: Persona,
  domain: Domain,
  markedText: string,
  dealInfo: DealInfo
): Promise<InvestmentAttractivenessAssessment | undefined> {
  const run = makeToolRunner(persona, domain, markedText, dealInfo);
  const t1 = Date.now();
  try {
    const raw = await run<Omit<InvestmentAttractivenessAssessment, "overallScore" | "verdict" | "verdictLine"> & { verdictReason: string; confirmItem: string }>(
      INVESTMENT_TOOL,
      undefined,
      (v) => Array.isArray(v.criteria) && v.criteria.length === INVESTMENT_CRITERIA.length
    );
    // 종합 점수는 모델이 아니라 코드가 확정 가중치로 계산 — 판단 불가 기준은 빼고 재정규화.
    for (const c of raw.criteria) {
      c.criterionLabel = INVESTMENT_CRITERIA.find((d) => d.id === c.criterion)?.label ?? c.criterionLabel;
      c.score = c.determinable === false ? 0 : calibrateScore(c.score);
    }
    const overallScore = computeWeightedScore(raw.criteria as { criterion: string; score: number; determinable: boolean }[]);
    console.log(`[evaluateInvestment] 투자 매력도 완료 (${Date.now() - t1}ms)`);
    return {
      ...raw,
      overallScore,
      // 화면의 점수와 결론 라벨이 어긋나지 않게 라벨은 최종 점수 기준으로 확정
      ...(overallScore == null ? {} : composeVerdict(overallScore, raw.verdictReason, raw.confirmItem)),
    };
  } catch (err) {
    console.error(`[evaluateInvestment] 투자 매력도 평가 실패 (${Date.now() - t1}ms):`, err);
    return undefined;
  }
}

export async function evaluateIr(
  persona: Persona,
  domain: Domain,
  markedText: string,
  dealInfo: DealInfo,
  mode: "external" | "internal" = "external",
  options: EvaluateOptions = {}
): Promise<EvaluationReport> {
  const run = makeToolRunner(persona, domain, markedText, dealInfo);
  // 기본 리포트는 모드에 맞는 시스템 프롬프트를 씀 (external은 투자 판단 금지 가드레일 포함)
  const baseSystem = buildSystemPrompt(persona, domain, mode);

  const t0 = Date.now();
  const report = fillCategoryLabels(await run<EvaluationReport>(buildReportTool(mode, options.includeStoryline), baseSystem));
  report.storyline = report.storyline ?? [];
  report.evaluatedModel = MODEL;
  // 모델이 후보에 없는 라벨을 지어내는 경우가 있어 해당 영역의 세부 영역 라벨과 정확히 일치할 때만 저장
  if (!domain.subDomains.some((s) => s.label === report.subDomain)) report.subDomain = undefined;
  console.log(`[evaluateIr] 기본 리포트 완료 (${Date.now() - t0}ms)`);

  if (mode === "internal" && !options.skipInvestment) {
    const ia = await evaluateInvestment(persona, domain, markedText, dealInfo);
    if (ia) report.investmentAttractiveness = ia;
  }

  return sanitizeReport(report);
}
