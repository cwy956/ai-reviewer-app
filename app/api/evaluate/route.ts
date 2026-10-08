import { NextResponse, after } from "next/server";
import { parsePdf, assessExtractionQuality } from "@/lib/parsePdf";
import { evaluateIr, evaluateInvestment } from "@/lib/evaluate";
import { getDomain, getSubDomain } from "@/lib/domains";
import { getPersona } from "@/lib/personas";
import { saveEvaluation, updateInvestmentAttractiveness } from "@/lib/evaluations/store";
import { downloadUpload, deleteUpload, saveSubmissionFile } from "@/lib/irUploads";
import { sendSubmissionAlert } from "@/lib/mail/submissionAlert";
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

    // 제출자 정보 — 회사명·담당자·이메일은 필수(심사역이 연락할 수단), 연락처·코멘트는 선택
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const companyName = str(body.companyName, 100);
    const contactName = str(body.contactName, 50);
    const contactEmail = str(body.contactEmail, 120);
    const contactPhone = str(body.contactPhone, 30);
    const comment = str(body.comment, 2000);
    if (!companyName || !contactName || !contactEmail) {
      return NextResponse.json({ error: "회사명, 담당자 이름, 이메일을 입력해 주세요." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
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
    // 글자를 하나도 못 읽는 파일(빈 PDF 등)은 AI를 부르기 전에 돌려보냄 — 비용이 나가기 전에 거르는 마지막 관문
    if (parsed.markedText.replace(/[p.d+]/g, "").trim().length < 30) {
      return NextResponse.json({ error: "PDF에서 읽을 수 있는 글자를 찾지 못했어요. 텍스트가 포함된 PDF인지 확인해 주세요." }, { status: 400 });
    }

    // 메일로 들어온 IR과 같은 평가(내부 모드)로 돌려서 심사역 화면이 두 경로에서 똑같이 나오게 함.
    // 단 투자 매력도(내부 전용, 약 1분)는 기업에게 응답한 뒤 백그라운드로 계산해서 기업의 대기 시간을 늘리지 않음.
    const report = await evaluateIr(persona, domain, parsed.markedText, dealInfo, "internal", {
      includeStoryline: true,
      skipInvestment: true,
    });
    report.extractionQuality = assessExtractionQuality(parsed);
    report.submission = {
      companyName,
      contactName,
      contactEmail,
      contactPhone: contactPhone || undefined,
      comment: comment || undefined,
      submittedAt: new Date().toISOString(),
    };

    // Every real submission through this page goes into the internal IR list. Awaited (not
    // fire-and-forget) — a serverless function can be frozen/torn down right after the response
    // is sent, which would silently drop an un-awaited background save. Best-effort: never let a
    // save failure break the response the startup is waiting on.
    let savedId: number | null = null;
    try {
      const saved = await saveEvaluation({
        source: "platform",
        companyName: companyName || report.companyName || undefined,
        attachmentFilename: originalName,
        domainId,
        personaId,
        personaName: persona.name,
        report,
      });
      savedId = saved.id;
      // 심사역이 원문을 열람·재평가할 수 있도록 원본도 보관 (실패해도 평가 결과 반환에는 영향 없음)
      await saveSubmissionFile(saved.id, buffer).catch((err) => console.error("제출 원본 보관 실패:", err));
      // 심사역(투자팀) 전원에게 새 투자 제안 알림 — 실패해도 제출·평가 결과 반환에는 영향 없음
      await sendSubmissionAlert({
        evaluationId: saved.id,
        report,
        domainLabel: domain.label,
        filename: originalName,
        file: buffer,
      }).catch((err) => console.error("새 투자 제안 알림 발송 실패:", err));
    } catch (err) {
      console.error("플랫폼 제출 저장 실패 (평가 결과는 정상 반환됨):", err);
    }

    if (savedId !== null) {
      const evaluationId = savedId;
      after(async () => {
        try {
          const ia = await evaluateInvestment(persona, domain, parsed.markedText, dealInfo);
          if (ia) await updateInvestmentAttractiveness(evaluationId, ia);
        } catch (err) {
          console.error(`제출 #${evaluationId} 투자 매력도 백그라운드 계산 실패:`, err);
        }
      });
    }

    // 기업에게 보여주는 결과에는 내부 전용 항목(투자 매력도, 제출자 연락처 등)을 넣지 않음
    const { investmentAttractiveness: _internalOnly, ...companyView } = report;
    void _internalOnly;
    return NextResponse.json({
      report: companyView,
      meta: { pageCount: parsed.pageCount, truncated: parsed.truncated },
    });
  } catch (err) {
    console.error("Evaluation failed:", err);
    const message = err instanceof Error ? err.message : "평가 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // 임시 업로드 파일은 평가가 끝나면(성공/실패 무관) 삭제 — 영구 보관본은 위에서 ir-submissions에 따로 저장.
    if (storagePath) await deleteUpload(storagePath);
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
