import Anthropic from "@anthropic-ai/sdk";
import type { EvaluationReport, PeerResearchResult } from "./reportSchema";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const PEER_RESEARCH_SCHEMA: Anthropic.Tool["input_schema"] = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", description: "이 기업과 비교 대상들에 대한 2~3문장 총평" },
    peers: {
      type: "array",
      description: "비교 가능한 실제 유사 기업 3~5곳",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string", description: "무엇을 하는 회사인지 1~2문장" },
          comparisonNote: { type: "string", description: "이 스타트업과 비교했을 때 비슷하거나 다른 점" },
          url: { type: "string", description: "출처 URL. 모르면 빈 문자열." },
        },
        required: ["name", "description", "comparisonNote", "url"],
      },
    },
  },
  required: ["summary", "peers"],
};

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "submit_peer_research",
  description: "웹 검색으로 찾은 유사 기업 비교 결과를 구조화된 형태로 제출합니다.",
  strict: true,
  input_schema: PEER_RESEARCH_SCHEMA,
};

/** Builds a research prompt from the already-extracted evaluation (not the original PDF) — the
 * report's own summaries/storyline already describe what the company does, so there's no need to
 * re-fetch the attachment just to ask "what does this company do". */
export function buildCompanyDescription(dealTitle: string, domainLabel: string, report: EvaluationReport): string {
  const lines = [
    `[회사/딜 제목] ${dealTitle}`,
    `[평가 영역] ${domainLabel}`,
    `[총평] ${report.verdictSummary}`,
    ...report.storyline.map((s) => `[${s.title}] ${s.detail}`),
    ...report.categoryScores.map((c) => `[${c.categoryLabel} 요약] ${c.summary}`),
    `[산업 적합성 총평] ${report.industryFit.summary}`,
  ];
  return lines.join("\n");
}

/**
 * Two-call pattern (same reasoning as evaluateIr's split calls): the first call runs with
 * Anthropic's server-side web_search tool enabled and tool_choice left to "auto" so the model can
 * freely search and write up findings in plain text; forcing a specific tool in that same call
 * would disable the model's ability to also call web_search. The second call takes that findings
 * text (no web_search tool this time) and forces a strict structured submit_peer_research call so
 * the UI gets clean, typed data instead of parsing free text.
 */
export async function researchPeers(companyDescription: string, domainLabel: string): Promise<PeerResearchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되어 있지 않습니다.");
  }
  const client = new Anthropic({ apiKey });

  const searchResponse = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: `당신은 벤처캐피탈 심사역을 돕는 리서치 어시스턴트입니다. 주어진 스타트업 설명을 읽고, 웹 검색을 통해 같은 영역("${domainLabel}")에서 사업모델·기술·시장이 비교 가능한 실제 기업(국내 또는 해외, 스타트업 또는 상장사 무관)을 3~5곳 찾으세요. 각 기업에 대해 무엇을 하는 회사인지, 이 스타트업과 비교했을 때 포지셔닝·투자유치 현황·기술 접근이 어떻게 비슷하거나 다른지를 간결하게 정리하세요. 검색 결과로 확인되지 않은 사실은 지어내지 마세요.`,
    messages: [{ role: "user", content: companyDescription }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
  });

  const findingsText = searchResponse.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n")
    .trim();

  if (!findingsText) {
    throw new Error("웹 리서치 결과를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.");
  }

  const structured = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system:
      "아래는 한 스타트업과 비교 가능한 유사 기업들에 대한 웹 리서치 결과입니다. submit_peer_research 도구를 호출해 구조화된 형태로 제출하세요. url을 모르면 빈 문자열로 두세요.",
    messages: [{ role: "user", content: findingsText }],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
  });

  const toolUse = structured.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("리서치 결과를 구조화하지 못했습니다.");
  }

  const parsed = toolUse.input as {
    summary: string;
    peers: { name: string; description: string; comparisonNote: string; url: string }[];
  };

  return {
    summary: parsed.summary,
    peers: parsed.peers.map((p) => ({ ...p, url: p.url || null })),
    researchedAt: new Date().toISOString(),
  };
}
