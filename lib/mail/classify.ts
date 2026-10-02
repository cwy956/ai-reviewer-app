import Anthropic from "@anthropic-ai/sdk";
import type { MailSummary } from "./client";
import { domains } from "../domains";

export type MailCategory = "ir" | "invest_other" | "gov_program" | "biz_proposal" | "spam" | "etc";

export const CATEGORY_LABELS: Record<MailCategory, string> = {
  ir: "IR·투자관련",
  invest_other: "투자 관련(행사·LP·출자)",
  gov_program: "정부지원사업·공고",
  biz_proposal: "협업·영업 제안",
  spam: "스팸·광고",
  etc: "기타",
};

export const CATEGORY_ORDER: MailCategory[] = ["ir", "invest_other", "gov_program", "biz_proposal", "etc", "spam"];

/** 메일이 어느 팀으로 가는지 — 투자팀(심사역)이 직접 봐야 하는 것 vs 관리팀이 처리할 것. 스팸은 어디로도 안 감. */
export type MailTeam = "investment" | "admin";
export function teamOf(category: MailCategory): MailTeam | null {
  if (category === "ir" || category === "invest_other") return "investment";
  if (category === "spam") return null;
  return "admin";
}

const DOMAIN_IDS = domains.map((d) => d.id);

export interface ClassifiedMail extends MailSummary {
  category: MailCategory;
  reason: string;
  priority: "높음" | "중간" | "낮음";
  /** Only meaningful when category === "ir" — which of the 9 industry domains this deal belongs
   * to, used to route the alert to the reviewer(s) who cover that domain. Null otherwise. */
  domainId: string | null;
}

export const MODEL = process.env.MAIL_CLASSIFY_MODEL || "claude-haiku-4-5";
// 한 번에 너무 많이 넣으면 출력이 max_tokens에 잘려 그 묶음 전체가 "분류 실패"로 떨어짐(실제로 발생).
export const BATCH_SIZE = 20;

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
            category: { type: "string", enum: ["ir", "invest_other", "gov_program", "biz_proposal", "spam", "etc"] },
            reason: { type: "string", description: "한 줄 분류 근거 (40자 이내로 짧게)" },
            priority: {
              type: "string",
              enum: ["높음", "중간", "낮음"],
              description: "심사역이 우선 검토할 가치 — category가 ir일 때만 의미 있음, 그 외는 낮음으로",
            },
            domainId: {
              type: ["string", "null"],
              enum: [...DOMAIN_IDS, null],
              description:
                "category가 ir일 때만: 이 스타트업이 속한 업종 도메인 ID (담당 심사역 라우팅용). ir이 아니면 null.",
            },
          },
          required: ["msgNum", "category", "reason", "priority", "domainId"],
        },
      },
    },
    required: ["results"],
  },
};

export const SYSTEM_PROMPT = `당신은 벤처캐피탈 심사역의 공용 이메일함을 정리하는 어시스턴트입니다.
각 메일을 다음 6개 카테고리 중 하나로 분류하세요. 핵심 기준은 "투자팀(심사역)이 직접 봐야 하는가, 관리팀이 처리하면 되는가"입니다.

[투자팀으로 가는 것]
- ir: 특정 스타트업 한 곳이 자사의 사업계획서·피치덱을 보내며 실제 투자 검토·상담을 요청하는 메일. 창업진흥센터·창조경제혁신센터·포럼 등 중개기관을 통해 전달되는 경우도 포함하되, 그 경우에도 "이 스타트업을 검토해달라"는 특정 1개 기업 단위의 요청이어야 함. 사업계획서/피치덱 첨부파일이 있는 경우가 전형적임(첨부가능성 "없음"이면 ir일 가능성이 낮음).
- invest_other: 특정 기업 1곳의 IR은 아니지만 투자 업무와 직결되어 투자팀이 봐야 하는 메일.
    - 데모데이·IR 밋업·투자 컨퍼런스·포럼·VC 네트워킹 행사의 참석 요청·초청·안내 (다수 스타트업을 한꺼번에 소개하는 안내 포함)
    - LP 참여·출자 참여·펀드 출자 제안, 정책형·모태 펀드 출자사업 공고·안내, 펀드 결성·운용 관련 연락
    - 공동투자(Co-invest) 제안, 투자 라운드 참여 제안(특정 라운드에 같이 투자하자는 요청)

[관리팀으로 가는 것]
- gov_program: 정책자금·지원사업 공고, 행정 협조 요청, 세무·회계·법무·규제 관련 순수 공지·안내성 메일 (투자 업무와 무관한 행정)
- biz_proposal: 우리 회사에 무언가를 팔거나 제공하겠다는 영업·제휴 제안 — 솔루션·SaaS 도입, 사무공간·기업 공간 디자인·인테리어, 사업공간 제휴·제공, 데이터·정보서비스·마케팅 영업, 자료 없는 기업 소개/중개 메일 (스타트업의 투자유치 목적이 아닌 것)
- etc: 위 어디에도 해당하지 않는 것

- spam: 광고, 스팸성 메일 (어디로도 전달되지 않음)

[헷갈리기 쉬운 경우]
- "데모데이 참석해주세요" → invest_other (ir 아님, 관리 아님)
- "저희 펀드에 LP로 참여해주세요 / 출자 제안" → invest_other
- "첨부 없이 좋은 기업 있으니 관심 있으면 연락주세요" 식의 짧은 중개 메일 → biz_proposal
- "기업 공간 디자인 제안드립니다", "사업 공간 제휴 제공" → biz_proposal (관리)
- 특정 스타트업이 자료를 첨부해 투자를 요청 → ir

category가 ir인 경우에만 priority를 의미 있게 판단하세요 (제목·발신자·본문 스니펫으로 볼 때 실제 검토할 만한 딜로 보이면 "높음"). 그 외 카테고리는 priority를 "낮음"으로 두세요.

category가 ir인 경우, 이 스타트업이 속한 업종을 아래 도메인 중 하나로 판별해 domainId에 넣으세요 (제목·발신자·본문 스니펫에서 업종을 특정할 근거가 부족하면 "etc"):
${domains.map((d) => `- ${d.id}: ${d.label}${d.subDomains.length ? ` (${d.subDomains.map((s) => s.label).join(", ")})` : ""}`).join("\n")}
category가 ir이 아니면 domainId는 반드시 null로 두세요.

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
    (input as {
      results?: Array<{
        msgNum: number;
        category: MailCategory;
        reason: string;
        priority: "높음" | "중간" | "낮음";
        domainId?: string | null;
      }>;
    })?.results ?? [];
  const map = new Map<number, ClassifyFields>();
  for (const r of results) {
    map.set(r.msgNum, {
      category: r.category,
      reason: r.reason,
      priority: r.priority,
      domainId: r.category === "ir" ? (r.domainId ?? null) : null,
    });
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
      domainId: result?.domainId ?? null,
    };
  });
}

async function classifyBatch(client: Anthropic, mails: MailSummary[]): Promise<Map<number, ClassifyFields>> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `다음 이메일 목록을 분류하세요.\n\n${formatMailBatch(mails)}` }],
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: "classify_mails" },
  });

  if (response.stop_reason === "max_tokens") {
    console.error(`[classify] 출력이 max_tokens에서 잘림 (메일 ${mails.length}건) — 이 묶음 결과가 누락될 수 있음`);
  }
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
