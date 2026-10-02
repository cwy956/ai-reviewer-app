import Anthropic from "@anthropic-ai/sdk";
import { domains, getDomain } from "./domains";
import { MODEL } from "./mail/classify";

const DOMAIN_IDS = domains.map((d) => d.id);

const TOOL: Anthropic.Tool = {
  name: "submit_domain",
  description: "이 회사가 속한 영역과 세부 영역을 제출합니다.",
  input_schema: {
    type: "object",
    properties: {
      domainId: { type: "string", enum: DOMAIN_IDS },
      subDomain: {
        type: "string",
        description: "선택한 영역의 세부 영역 후보 중 가장 가까운 것(라벨 그대로). 맞는 게 없으면 빈 문자열.",
      },
    },
    required: ["domainId", "subDomain"],
  },
};

function domainGuide(): string {
  return domains
    .map((d) => `- ${d.id}: ${d.categoryLabel} > ${d.label}${d.subDomains.length ? ` (${d.subDomains.map((s) => s.label).join(", ")})` : ""}`)
    .join("\n");
}

/**
 * 메일 분류 단계는 제목·발신자·본문 200자만 보기 때문에 본문이 비어 있고 PDF에만 내용이 있는 IR은
 * 영역을 알 수 없어 "기타"로 떨어졌음. IR 자료 자체를 읽고 영역을 다시 정하는 보정 단계.
 * 실패하면 null을 돌려주고, 호출한 쪽이 기존 영역을 그대로 쓰면 됨.
 */
export async function detectDomain(companyText: string): Promise<{ domainId: string; subDomain: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !companyText.trim()) return null;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: `당신은 벤처캐피탈의 딜 분류 담당입니다. 아래 회사 설명을 읽고 가장 맞는 영역 하나와 세부 영역을 고르세요. 어느 산업 영역에도 맞지 않을 때만 etc를 쓰세요.\n\n[영역 목록]\n${domainGuide()}`,
      messages: [{ role: "user", content: companyText.slice(0, 8000) }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
    });
    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const input = toolUse?.input as { domainId?: string; subDomain?: string } | undefined;
    if (!input?.domainId || !getDomain(input.domainId)) return null;
    return { domainId: input.domainId, subDomain: input.subDomain ?? "" };
  } catch (err) {
    console.error("[detect-domain] 영역 판별 실패 (기존 영역 유지):", err instanceof Error ? err.message : err);
    return null;
  }
}
