// 이미 저장된 평가에 "주요 재무지표(IR 기재 수치)"만 덧붙임 — 점수·총평 등 기존 내용은 건드리지 않음.
// 저장해 둔 원본 PDF(메일 캐시 / 플랫폼 제출 파일)를 다시 읽어 재무 수치만 뽑는 작은 호출 한 번이라 건당 비용이 작음.
//
// Usage:
//   npx tsx scripts/backfill-financials.mts                 # 2026년 이후 딜 중 재무지표가 없는 평가 전부
//   npx tsx scripts/backfill-financials.mts --since 2025    # 기준 연도 변경
//   npx tsx scripts/backfill-financials.mts --limit 3       # 앞에서 3건만 (시험용)
//   npx tsx scripts/backfill-financials.mts --dry           # 저장하지 않고 결과만 출력
//
// 모델은 ANTHROPIC_MODEL(기본 Haiku 5.5 — 수치 옮겨 적기만 하므로 가벼운 모델로 충분하고 저렴).

import path from "path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const { getSupabase } = await import("../lib/db/supabaseClient");
const { getCachedMessage } = await import("../lib/mail/messageCache");
const { downloadSubmissionFile } = await import("../lib/irUploads");
const { parsePdf } = await import("../lib/parsePdf");
const { FINANCIALS_SCHEMA, normalizeFinancials } = await import("../lib/financials");
type FinancialSummary = import("../lib/reportSchema").FinancialSummary;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const sinceYear = Number(flag("--since") ?? 2026);
const limit = Number(flag("--limit") ?? Infinity);
const dry = args.includes("--dry");
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const tool: Anthropic.Tool = {
  name: "submit_financials",
  description: "IR 자료에 적힌 연도별 주요 재무 수치를 제출합니다.",
  strict: true,
  input_schema: FINANCIALS_SCHEMA as unknown as Anthropic.Tool["input_schema"],
};

async function extract(markedText: string): Promise<FinancialSummary | undefined> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system:
      "당신은 IR 자료에서 재무 수치를 옮겨 적는 보조자입니다. 자료에 실제로 적힌 매출액·영업이익·당기순이익만 연도별로 제출하세요. 자료에 없는 값을 계산하거나 짐작해서 채우지 마세요.",
    messages: [{ role: "user", content: `다음 IR 자료에서 연도별 매출액·영업이익·당기순이익을 찾아 제출하세요.\n\n${markedText}` }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });
  console.log(`   [usage] in=${res.usage.input_tokens} out=${res.usage.output_tokens}`);
  const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  return normalizeFinancials(use?.input as FinancialSummary | undefined);
}

const sb = getSupabase();
const { data: rows, error } = await sb
  .from("ir_evaluations")
  .select("id, source, msg_num, attachment_index, company_name, report")
  .order("id", { ascending: true });
if (error) throw new Error(error.message);

// 메일 딜의 수신 연도
const msgNums = (rows ?? []).filter((r) => r.source === "mail" && r.msg_num != null).map((r) => r.msg_num as number);
const { data: mails } = await sb.from("classified_mails").select("msg_num, mail_date, processed_at").in("msg_num", msgNums);
const yearByMsg = new Map<number, number>();
for (const m of mails ?? []) yearByMsg.set(m.msg_num as number, new Date((m.mail_date ?? m.processed_at) as string).getFullYear());

let done = 0, skipped = 0, failed = 0;
for (const row of rows ?? []) {
  if (done >= limit) break;
  const report = row.report as Record<string, unknown>;
  if (report.financials) continue;
  const year = row.source === "mail" ? yearByMsg.get(row.msg_num as number) : new Date().getFullYear();
  if (year == null || year < sinceYear) continue;

  console.log(`#${row.id} ${row.company_name ?? "(이름 없음)"} [${row.source}${row.msg_num ? ` mail ${row.msg_num}` : ""}]`);
  try {
    let pdf: Buffer | null = null;
    if (row.source === "platform") {
      pdf = await downloadSubmissionFile(row.id as number);
    } else {
      const full = await getCachedMessage(row.msg_num as number);
      const att = full?.attachments.find((a) => a.index === row.attachment_index) ?? full?.attachments.find((a) => a.content);
      if (att?.content) pdf = Buffer.from(att.content, "base64");
    }
    if (!pdf) {
      console.log("   원본 PDF를 찾지 못해 건너뜀");
      skipped++;
      continue;
    }
    const parsed = await parsePdf(pdf);
    const financials = await extract(parsed.markedText);
    if (!financials) {
      failed++;
      continue;
    }
    console.log(
      "   " + (financials.rows.length ? financials.rows.map((r) => `${r.year}${r.kind === "추정" ? "(추정)" : ""}: 매출 ${r.revenue ?? "-"} / 영업 ${r.operatingProfit ?? "-"} / 순익 ${r.netIncome ?? "-"}`).join(" | ") : "IR에 재무 수치 없음") + (financials.note ? `  [${financials.note}]` : "")
    );
    if (!dry) {
      const { error: upErr } = await sb.from("ir_evaluations").update({ report: { ...report, financials } }).eq("id", row.id);
      if (upErr) throw new Error(upErr.message);
    }
    done++;
  } catch (err) {
    failed++;
    console.error("   실패:", err instanceof Error ? err.message : err);
  }
}
console.log(`\n완료 ${done}건 · 원본 없음 ${skipped}건 · 실패 ${failed}건${dry ? " (dry-run: 저장 안 함)" : ""}`);
