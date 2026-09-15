import Anthropic from "@anthropic-ai/sdk";
import type { Domain } from "./domains";
import { CATEGORY_LABELS } from "./domains";
import type { Persona } from "./personas/schema";
import { buildSystemPrompt, buildUserMessage, type DealInfo } from "./buildPrompt";
import type { EvaluationReport } from "./reportSchema";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const CITED_POINT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string" },
    pageRefs: { type: "array", items: { type: "integer" } },
  },
  required: ["text", "pageRefs"],
} as const;

const INVESTMENT_ATTRACTIVENESS_SCHEMA = {
  type: "object",
  description:
    "내부 심사역 전용 투자 매력도 진단. industryFit/categoryScores와 달리 투자 판단 언어를 명시적으로 허용함.",
  additionalProperties: false,
  properties: {
    overallScore: { type: "integer", description: "0에서 100 사이, 종합 투자 매력도 점수" },
    summary: { type: "string", description: "투자 관점 종합 총평" },
    criteria: {
      type: "array",
      description: "정확히 5개 원소 (market, competitiveAdvantage, teamExecution, traction, valuationFit 각 1개씩)",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          criterion: {
            type: "string",
            enum: ["market", "competitiveAdvantage", "teamExecution", "traction", "valuationFit"],
          },
          criterionLabel: { type: "string" },
          score: { type: "integer" },
          rationale: { type: "string" },
          pageRefs: { type: "array", items: { type: "integer" } },
        },
        required: ["criterion", "criterionLabel", "score", "rationale", "pageRefs"],
      },
    },
    strongPoints: { type: "array", items: CITED_POINT_SCHEMA },
    concerns: { type: "array", items: CITED_POINT_SCHEMA },
  },
  required: ["overallScore", "summary", "criteria", "strongPoints", "concerns"],
} as const;

function buildReportTool(mode: "external" | "internal"): Anthropic.Tool {
  const properties: Record<string, unknown> = {
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

  if (mode === "internal") {
    properties.investmentAttractiveness = INVESTMENT_ATTRACTIVENESS_SCHEMA;
    required.push("investmentAttractiveness");
  }

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
  const reportTool = buildReportTool(mode);

  const attempt = async (): Promise<EvaluationReport> => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: userMessage }],
      tools: [reportTool],
      tool_choice: { type: "tool", name: "submit_report" },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) {
      throw new Error("모델이 구조화된 결과를 반환하지 않았습니다.");
    }
    return fillCategoryLabels(toolUse.input as EvaluationReport);
  };

  try {
    return await attempt();
  } catch (err) {
    console.error("evaluateIr first attempt failed, retrying once:", err);
    return await attempt();
  }
}
