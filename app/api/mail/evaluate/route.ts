import { NextResponse } from "next/server";
import { fetchAttachmentContent } from "@/lib/mail/client";
import { parsePdf } from "@/lib/parsePdf";
import { evaluateIr } from "@/lib/evaluate";
import { getDomain } from "@/lib/domains";
import { getPersona } from "@/lib/personas";
import { saveEvaluation } from "@/lib/mail/evaluationStore";

export const runtime = "nodejs";
// Generous ceiling: attachment RETR (up to ~100s for a large PDF) + PDF parse + two sequential
// Claude tool calls (base report, then investmentAttractiveness) can add up past 120s.
export const maxDuration = 280;

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

    const attachment = await fetchAttachmentContent(msgNum, attachmentIndex);
    if (attachment.contentType !== "application/pdf" && !attachment.filename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "현재는 PDF 첨부파일만 평가할 수 있습니다." }, { status: 400 });
    }

    const parsed = await parsePdf(attachment.content);
    const report = await evaluateIr(persona, domain, parsed.markedText, {}, "internal");

    const evaluation = await saveEvaluation({
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
