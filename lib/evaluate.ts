import Anthropic from "@anthropic-ai/sdk";
import type { Domain } from "./domains";
import { CATEGORY_LABELS } from "./domains";
import type { Persona } from "./personas/schema";
import { buildSystemPrompt, buildUserMessage, type DealInfo } from "./buildPrompt";
import type { EvaluationReport, InvestmentAttractivenessAssessment } from "./reportSchema";
import { INVESTMENT_CRITERIA, CHECK_VERDICTS, computeWeightedScore, calibrateScore, verdictForScore } from "./investmentCriteria";

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
    verdict: {
      type: "string",
      enum: ["적극 검토", "조건부 검토", "보류"],
      description: "투자 검토 결론. 적극 검토=지금 바로 투자 검토에 착수할 만함, 조건부 검토=핵심 확인 사항이 해소되면 검토 가능, 보류=구조적 약점이 직접 드러나 현 시점 검토 비권장",
    },
    verdictLine: {
      type: "string",
      description: "총평 결론 한 줄(60자 이내, 개조식). 검토 여부와 그 조건/이유를 담을 것. 예: 적극 투자 검토 필요 — 실명 대기업 레퍼런스·확정 수주 다수 / 수주 86억 중 확정 계약분 확인되면 투자 검토 가능",
    },
    summary: { type: "string", description: "결론을 뒷받침하는 핵심 근거 개조식 2~3줄(줄바꿈 구분). 결론 문구는 반복하지 말 것" },
    criteria: {
      type: "array",
      description: "정확히 4개 원소 (techAdvantage, tractionCertainty, concentrationRisk, valuationFit 각 1개씩). checks는 항상 빈 배열.",
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
          headline: { type: "string", description: "이 기준의 판단 핵심을 한 줄로 (35자 이내, 예: 실명 대기업 레퍼런스 다수, 계약 세부는 불명)" },
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
  required: ["verdict", "verdictLine", "summary", "criteria", "strongPoints", "concerns", "reviewerNextSteps"],
};

const INVESTMENT_TOOL: Anthropic.Tool = {
  name: "submit_investment_attractiveness",
  description: "내부 심사역 전용 투자 매력도 진단을 구조화된 형태로 제출합니다.",
  strict: true,
  input_schema: INVESTMENT_ATTRACTIVENESS_SCHEMA,
};

function buildReportTool(): Anthropic.Tool {
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
    "storyline",
    "actionPlan",
    "reviewerQuestions",
  ];

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

export async function evaluateIr(
  persona: Persona,
  domain: Domain,
  markedText: string,
  dealInfo: DealInfo,
  mode: "external" | "internal" = "external"
): Promise<EvaluationReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env.local을 확인하세요.");
  }

  const client = new Anthropic({ apiKey });
  const system = buildSystemPrompt(persona, domain, mode);
  const userMessage = buildUserMessage(markedText, dealInfo);

  // Two separate strict tool calls instead of one combined schema. investmentAttractiveness
  // used to be merged into submit_report's schema, but that pushed the strict-mode constrained
  // grammar over Anthropic's compilation size limit ("compiled grammar is too large" 400 —
  // deterministic, so retrying the combined call never helped). Splitting keeps each schema
  // small enough for strict mode, which non-strict mode couldn't reliably replace: without it,
  // the model garbled nested fields (e.g. dumped raw tool-call syntax into a string field).
  const runToolCall = async <T>(tool: Anthropic.Tool, validate?: (v: T) => boolean): Promise<T> => {
    const attempt = async (): Promise<T> => {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system,
        messages: [{ role: "user", content: userMessage }],
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      });
      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );
      if (!toolUse) {
        throw new Error("모델이 구조화된 결과를 반환하지 않았습니다.");
      }
      const result = toolUse.input as T;
      if (validate && !validate(result)) throw new Error("모델 결과가 기대 형식(기준 4개)을 충족하지 않습니다.");
      return result;
    };

    try {
      return await attempt();
    } catch (err) {
      console.error(`evaluateIr ${tool.name} 첫 시도 실패, 재시도:`, err);
      return await attempt();
    }
  };

  const t0 = Date.now();
  const report = fillCategoryLabels(await runToolCall<EvaluationReport>(buildReportTool()));
  // 모델이 후보에 없는 라벨을 지어내는 경우가 있어 해당 영역의 세부 영역 라벨과 정확히 일치할 때만 저장
  if (!domain.subDomains.some((s) => s.label === report.subDomain)) report.subDomain = undefined;
  console.log(`[evaluateIr] 기본 리포트 완료 (${Date.now() - t0}ms)`);

  if (mode === "internal") {
    // Don't let a slow/failing second call (even after its own retry) throw away the base report
    // that already succeeded and cost real API time/money — degrade to "no investment axis" and
    // let the UI (which already renders this field conditionally) show the rest.
    const t1 = Date.now();
    try {
      const raw = await runToolCall<Omit<InvestmentAttractivenessAssessment, "overallScore">>(
        INVESTMENT_TOOL,
        (v) => Array.isArray(v.criteria) && v.criteria.length === INVESTMENT_CRITERIA.length
      );
      // 종합 점수는 모델이 아니라 코드가 확정 가중치로 계산 — 판단 불가 기준은 빼고 재정규화.
      for (const c of raw.criteria) {
        c.criterionLabel = INVESTMENT_CRITERIA.find((d) => d.id === c.criterion)?.label ?? c.criterionLabel;
        c.score = c.determinable === false ? 0 : calibrateScore(c.score);
      }
      const overallScore = computeWeightedScore(raw.criteria as { criterion: string; score: number; determinable: boolean }[]);
      report.investmentAttractiveness = {
        ...raw,
        overallScore,
        // 화면의 점수와 결론 라벨이 어긋나지 않게 라벨은 최종 점수 기준으로 확정
        verdict: overallScore == null ? raw.verdict : verdictForScore(overallScore),
      };
      console.log(`[evaluateIr] 투자 매력도 완료 (${Date.now() - t1}ms)`);
    } catch (err) {
      console.error(`[evaluateIr] 투자 매력도 평가 실패, 기본 리포트만 반환 (${Date.now() - t1}ms):`, err);
    }
  }

  return report;
}
