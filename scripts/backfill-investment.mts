// 투자 매력도 평가가 빠진 저장 평가(예: 플랫폼 제출 직후 백그라운드 계산이 끊긴 건)를 원본 PDF로 다시 계산해 채움.
// 다른 내용(점수·총평·재무지표 등)은 건드리지 않음.
//
// Usage:
//   npx tsx scripts/backfill-investment.mts            # 투자 매력도가 없는 평가 전부
//   npx tsx scripts/backfill-investment.mts 37 60      # 지정한 평가 id만

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const { getSupabase } = await import("../lib/db/supabaseClient");
const { getCachedMessage } = await import("../lib/mail/messageCache");
const { downloadSubmissionFile } = await import("../lib/irUploads");
const { parsePdf } = await import("../lib/parsePdf");
const { getDomain } = await import("../lib/domains");
const { getPersona } = await import("../lib/personas");
const { evaluateInvestment } = await import("../lib/evaluate");
const { updateInvestmentAttractiveness } = await import("../lib/evaluations/store");

const onlyIds = process.argv.slice(2).map(Number).filter(Boolean);
const sb = getSupabase();
const { data: rows, error } = await sb
  .from("ir_evaluations")
  .select("id, source, msg_num, attachment_index, company_name, domain_id, persona_id, report")
  .order("id", { ascending: true });
if (error) throw new Error(error.message);

for (const row of rows ?? []) {
  const report = row.report as { investmentAttractiveness?: unknown };
  if (onlyIds.length ? !onlyIds.includes(row.id as number) : report.investmentAttractiveness) continue;
  console.log(`#${row.id} ${row.company_name} [${row.source}]`);
  let pdf: Buffer | null = null;
  if (row.source === "platform") pdf = await downloadSubmissionFile(row.id as number);
  else {
    const full = await getCachedMessage(row.msg_num as number);
    const att = full?.attachments.find((a) => a.index === row.attachment_index) ?? full?.attachments.find((a) => a.content);
    if (att?.content) pdf = Buffer.from(att.content, "base64");
  }
  const domain = getDomain(row.domain_id as string);
  const persona = await getPersona(row.persona_id as string);
  if (!pdf || !domain || !persona) {
    console.log("   원본/영역/심사역을 찾지 못해 건너뜀");
    continue;
  }
  const parsed = await parsePdf(pdf);
  const ia = await evaluateInvestment(persona, domain, parsed.markedText, {});
  if (!ia) {
    console.log("   투자 매력도 계산 실패");
    continue;
  }
  await updateInvestmentAttractiveness(row.id as number, ia);
  console.log(`   완료: ${ia.overallScore ?? "판단 불가"}점 ${ia.verdict ?? ""}`);
}
