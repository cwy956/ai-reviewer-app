import Anthropic from "@anthropic-ai/sdk";
import type { MailSummary } from "./client";

export type MailCategory = "ir" | "gov_program" | "biz_proposal" | "spam" | "etc";

export const CATEGORY_LABELS: Record<MailCategory, string> = {
  ir: "IR·투자관련",
  gov_program: "정부지원사업·공고",
  biz_proposal: "협업·영업 제안",
  spam: "스팸·광고",
  etc: "기타",
};

export const CATEGORY_ORDER: MailCategory[] = ["ir", "gov_program", "biz_proposal", "etc", "spam"];

export interface ClassifiedMail extends MailSummary {
  category: MailCategory;
  reason: string;
  priority: "높음" | "중간" | "낮음";
}

export const MODEL = process.env.MAIL_CLASSIFY_MODEL || "claude-haiku-4-5";
export const BATCH_SIZE = 60;

export type ClassifyFields = Omit<ClassifiedMail, keyof MailSummary>;

export const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "classify_mails",
  description: "이메일 목록을 분류해 제출합니다.",
  input_schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            msgNum: { type: "integer" },
            category: { type: "string", enum: ["ir", "gov_program", "biz_proposal", "spam", "etc"] },
            reason: { type: "string", description: "한 줄 분류 근거" },
            priority: {
              type: "string",
              enum: ["높음", "중간", "낮음"],
              description: "심사역이 우선 검토할 가치 — category가 ir일 때만 의미 있음, 그 외는 낮음으로",
            },
          },
          required: ["msgNum", "category", "reason", "priority"],
        },
      },
    },
    required: ["results"],
  },
};

export const SYSTEM_PROMPT = `당신은 벤처캐피탈 심사역의 공용 이메일함을 정리하는 어시스턴트입니다.
각 메일을 다음 5개 카테고리 중 하나로 분류하세요.

- ir: 스타트업의 IR·피치덱·투자유치 제안, 데모데이·IR 밋업 초청, 1:1 투자상담 요청 등 — 창업진흥센터·창조경제혁신센터·포럼 등 중개기관을 통해 전달되는 경우를 포함해 실제 딜소싱·투자 검토와 관련된 모든 메일
- gov_program: 정책자금·공고·행정 협조 요청 등 순수 행정성 공지 (투자상담·밋업·데모데이 초청은 여기가 아니라 ir로 분류)
- biz_proposal: 솔루션 도입 제안, 영업, 제휴·협업 제안 (스타트업의 투자유치 목적이 아닌 것)
- spam: 광고, 스팸성 메일
- etc: 위 어디에도 해당하지 않는 것

category가 ir인 경우에만 priority를 의미 있게 판단하세요 (제목·발신자·본문 스니펫으로 볼 때 실제 검토할 만한 딜로 보이면 "높음"). 그 외 카테고리는 priority를 "낮음"으로 두세요.
반드시 submit_classification 도구(classify_mails)를 호출해 결과를 제출하세요. 입력된 모든 msgNum에 대해 결과를 채워야 합니다.`;

/**
 * Detects mail sent from the company's own domain — typically internal announcements (딜노트,
 * 투심 공지, 주간회의 등) that hit the shared inbox only because they were CC'd to a
 * company-wide address list. These are never worth alerting anyone about, regardless of what
 * category the model assigns, so callers filter on this before building notification content.
 */
const COMPANY_MAIL_DOMAIN = (process.env.COMPANY_MAIL_DOMAIN || "andaasiavc.com").toLowerCase();
export function isInternalSender(from: string): boolean {
  return from.toLowerCase().includes(`@${COMPANY_MAIL_DOMAIN}`);
}

export function formatMailBatch(mails: MailSummary[]): string {
  return mails
    .map(
      (m) =>
        `[${m.msgNum}] 발신: ${m.from} | 제목: ${m.subject} | 첨부가능성: ${m.hasAttachment ? "있음" : "없음"} | 본문 일부: ${m.snippet || "(본문 없음)"}`
    )
    .join("\n");
}

export function chunkMails(mails: MailSummary[], size: number = BATCH_SIZE): MailSummary[][] {
  const chunks: MailSummary[][] = [];
  for (let i = 0; i < mails.length; i += size) chunks.push(mails.slice(i, i + size));
  return chunks;
}

/** Extracts the classify_mails tool-call input into a msgNum -> fields map. Shared by the live and Batch API paths. */
export function parseClassifyToolInput(input: unknown): Map<number, ClassifyFields> {
  const results =
    (input as { results?: Array<{ msgNum: number; category: MailCategory; reason: string; priority: "높음" | "중간" | "낮음" }> })
      ?.results ?? [];
  const map = new Map<number, ClassifyFields>();
  for (const r of results) {
    map.set(r.msgNum, { category: r.category, reason: r.reason, priority: r.priority });
  }
  return map;
}

/** Merges classification results back onto the original mail summaries, filling gaps with a safe fallback. */
export function mergeClassifications(mails: MailSummary[], resultsByMsgNum: Map<number, ClassifyFields>): ClassifiedMail[] {
  return mails.map((mail) => {
    const result = resultsByMsgNum.get(mail.msgNum);
    return {
      ...mail,
      category: result?.category ?? "etc",
      reason: result?.reason ?? "분류 실패 — 기본값(기타)으로 표시됨",
      priority: result?.priority ?? "낮음",
    };
  });
}

async function classifyBatch(client: Anthropic, mails: MailSummary[]): Promise<Map<number, ClassifyFields>> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `다음 이메일 목록을 분류하세요.\n\n${formatMailBatch(mails)}` }],
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: "classify_mails" },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  return parseClassifyToolInput(toolUse?.input);
}

/** Live path: classifies a modest number of mails synchronously (used by the interactive dashboard). */
export async function classifyMails(mails: MailSummary[]): Promise<ClassifiedMail[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되어 있지 않습니다.");
  }
  if (mails.length === 0) return [];

  const client = new Anthropic({ apiKey });
  const chunks = chunkMails(mails);
  const chunkResults = await Promise.all(chunks.map((chunk) => classifyBatch(client, chunk)));
  const merged = new Map<number, ClassifyFields>();
  for (const m of chunkResults) {
    for (const [k, v] of m) merged.set(k, v);
  }
  return mergeClassifications(mails, merged);
}
