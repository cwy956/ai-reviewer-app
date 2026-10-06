import { NextResponse } from "next/server";
import { parsePdf, assessExtractionQuality } from "@/lib/parsePdf";
import { evaluateIr } from "@/lib/evaluate";
import { getDomain, getSubDomain } from "@/lib/domains";
import { getPersona } from "@/lib/personas";
import { saveEvaluation } from "@/lib/evaluations/store";
import { downloadUpload, deleteUpload } from "@/lib/irUploads";
import type { DealInfo } from "@/lib/buildPrompt";

export const runtime = "nodejs";
export const maxDuration = 300;

// 공개 IR 평가 페이지(/)에서만 쓰는 라우트 — 항상 external 모드(완성도+산업적합성만, 투자
// 매력도 없음). 내부 심사용 업로드 페이지(/internal-evaluate)는 제거됨: 메일함 IR은
// 자동평가되고, 남은 수동 평가는 /ir-deals가 담당(/api/mail/evaluate 사용).
export async function POST(request: Request) {
  let storagePath: string | null = null;
  try {
    // 파일은 Vercel 본문 한도(4.5MB)를 피하려고 브라우저가 Storage로 직접 올리고, 여기엔 경로만 JSON으로 옴.
    const body = (await request.json()) as Record<string, unknown>;
    const domainId = body.domainId;
    const personaId = body.personaId;
    const originalName = typeof body.filename === "string" && body.filename ? body.filename : "ir.pdf";

    if (typeof body.storagePath !== "string" || !/^[0-9a-f-]{36}.pdf$/.test(body.storagePath)) {
      return NextResponse.json({ error: "IR 파일이 필요합니다." }, { status: 400 });
    }
    storagePath = body.storagePath;
    if (typeof domainId !== "string" || typeof personaId !== "string") {
      return NextResponse.json({ error: "영역과 심사역을 선택해 주세요." }, { status: 400 });
    }

    const domain = getDomain(domainId);
    const persona = await getPersona(personaId);
    if (!domain) {
      return NextResponse.json({ error: "알 수 없는 영역입니다." }, { status: 400 });
    }
    if (!persona) {
      return NextResponse.json({ error: "알 수 없는 심사역입니다." }, { status: 400 });
    }

    const subDomainId = body.subDomainId;
    const subDomain = typeof subDomainId === "string" && subDomainId ? getSubDomain(domainId, subDomainId) : undefined;

    const dealInfo: DealInfo = {
      subDomain: subDomain?.label,
      stage: typeof body.stage === "string" && body.stage ? body.stage : undefined,
      preValuationEok: numberOrUndefined(body.preValuationEok),
      askAmountEok: numberOrUndefined(body.askAmountEok),
    };

    const buffer = await downloadUpload(storagePath);
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ error: "PDF 파일만 지원합니다." }, { status: 400 });
    }
    const parsed = await parsePdf(buffer);

    const report = await evaluateIr(persona, domain, parsed.markedText, dealInfo, "external");
    report.extractionQuality = assessExtractionQuality(parsed);

    // Every real submission through this page goes into the internal IR list. Awaited (not
    // fire-and-forget) — a serverless function can be frozen/torn down right after the response
    // is sent, which would silently drop an un-awaited background save. Best-effort: never let a
    // save failure break the response the startup is waiting on.
    const companyName = (typeof body.companyName === "string" && body.companyName) || report.companyName || undefined;
    try {
      await saveEvaluation({
        source: "platform",
        companyName,
        attachmentFilename: originalName,
        domainId,
        personaId,
        personaName: persona.name,
        report,
      });
    } catch (err) {
      console.error("플랫폼 제출 저장 실패 (평가 결과는 정상 반환됨):", err);
    }

    return NextResponse.json({
      report,
      meta: { pageCount: parsed.pageCount, truncated: parsed.truncated },
    });
  } catch (err) {
    console.error("Evaluation failed:", err);
    const message = err instanceof Error ? err.message : "평가 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // IR 원본은 보관하지 않는 정책 — 평가가 끝나면(성공/실패 무관) 임시 업로드 파일 삭제.
    if (storagePath) await deleteUpload(storagePath);
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
