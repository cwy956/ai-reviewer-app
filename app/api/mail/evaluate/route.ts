import { NextResponse } from "next/server";
import { fetchAttachmentContent } from "@/lib/mail/client";
import { parsePdf, assessExtractionQuality } from "@/lib/parsePdf";
import { evaluateIr } from "@/lib/evaluate";
import { getDomain } from "@/lib/domains";
import { getPersona } from "@/lib/personas";
import { saveEvaluation } from "@/lib/evaluations/store";

export const runtime = "nodejs";
// 300 = Vercel's hard ceiling on Hobby+Fluid Compute. Attachment RETR (up to ~100s for a large
// PDF) + PDF parse + two sequential Claude tool calls (base report, then
// investmentAttractiveness, each with its own one-time retry) can realistically approach this —
// a real run against a 4.8MB attachment took 127s with everything going smoothly; a slow RETR
// plus one retried call can push well past 200s.
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const msgNum = Number(body.msgNum);
    const attachmentIndex = Number(body.attachmentIndex);
    const domainId = typeof body.domainId === "string" ? body.domainId : "";
    const personaId = typeof body.personaId === "string" ? body.personaId : "";

    if (!Number.isFinite(msgNum) || !Number.isFinite(attachmentIndex) || !domainId || !personaId) {
      return NextResponse.json({ error: "필수 값이 누락되었습니다." }, { status: 400 });
    }

    const domain = getDomain(domainId);
    const persona = await getPersona(personaId);
    if (!domain) return NextResponse.json({ error: "알 수 없는 영역입니다." }, { status: 400 });
    if (!persona) return NextResponse.json({ error: "알 수 없는 심사역입니다." }, { status: 400 });

    const t0 = Date.now();
    const attachment = await fetchAttachmentContent(msgNum, attachmentIndex);
    console.log(`[mail/evaluate] 첨부파일 조회 완료 (${Date.now() - t0}ms, ${attachment.content.length}bytes)`);
    if (attachment.contentType !== "application/pdf" && !attachment.filename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "현재는 PDF 첨부파일만 평가할 수 있습니다." }, { status: 400 });
    }

    const parsed = await parsePdf(attachment.content);
    console.log(`[mail/evaluate] PDF 파싱 완료 (누적 ${Date.now() - t0}ms)`);
    const report = await evaluateIr(persona, domain, parsed.markedText, {}, "internal");
    report.extractionQuality = assessExtractionQuality(parsed);
    console.log(`[mail/evaluate] 평가 전체 완료 (누적 ${Date.now() - t0}ms)`);

    const evaluation = await saveEvaluation({
      source: "mail",
      msgNum,
      attachmentIndex,
      attachmentFilename: attachment.filename,
      domainId,
      personaId,
      personaName: persona.name,
      report,
    });

    return NextResponse.json({ evaluation, meta: { pageCount: parsed.pageCount, truncated: parsed.truncated } });
  } catch (err) {
    console.error("Mail evaluation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "평가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
