import Anthropic from "@anthropic-ai/sdk";
import type { Domain } from "./domains";
import { CATEGORY_LABELS } from "./domains";
import type { Persona } from "./personas/schema";
import { buildSystemPrompt, buildUserMessage, type DealInfo } from "./buildPrompt";
import type { EvaluationReport } from "./reportSchema";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const REPORT_TOOL: Anthropic.Tool = {
  name: "submit_report",
  description: "IR 평가 결과를 구조화된 형태로 제출합니다.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
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
    },
    required: [
      "totalScore",
      "verdictTag",
      "verdictSummary",
      "stageAssessment",
      "categoryScores",
      "strengths",
      "improvements",
      "storyline",
      "actionPlan",
      "reviewerQuestions",
    ],
  },
};

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
  dealInfo: DealInfo
): Promise<EvaluationReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env.local을 확인하세요.");
  }

  const client = new Anthropic({ apiKey });
  const system = buildSystemPrompt(persona, domain);
  const userMessage = buildUserMessage(markedText, dealInfo);

  const attempt = async (): Promise<EvaluationReport> => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: userMessage }],
      tools: [REPORT_TOOL],
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
