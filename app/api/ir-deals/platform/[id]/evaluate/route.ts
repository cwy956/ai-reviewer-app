import { NextResponse } from "next/server";
import { downloadSubmissionFile } from "@/lib/irUploads";
import { parsePdf, assessExtractionQuality } from "@/lib/parsePdf";
import { evaluateIr } from "@/lib/evaluate";
import { getDomain } from "@/lib/domains";
import { getPersona } from "@/lib/personas";
import { getPlatformSubmission, updateEvaluationReport } from "@/lib/evaluations/store";

export const runtime = "nodejs";
export const maxDuration = 300;

// 플랫폼 제출을 심사역이 내부 모드(투자 매력도 포함)로 다시 평가 — 보관된 원본을 사용하고 같은 행을 갱신.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const num = Number(id);
    const body = await request.json();
    const domainId = typeof body.domainId === "string" ? body.domainId : "";
    if (!Number.isInteger(num) || !domainId) {
      return NextResponse.json({ error: "필수 값이 누락되었습니다." }, { status: 400 });
    }
    const domain = getDomain(domainId);
    if (!domain) return NextResponse.json({ error: "알 수 없는 영역입니다." }, { status: 400 });

    const submission = await getPlatformSubmission(num);
    if (!submission) return NextResponse.json({ error: "제출을 찾을 수 없습니다." }, { status: 404 });
    const persona = await getPersona(submission.personaId);
    if (!persona) return NextResponse.json({ error: "알 수 없는 심사역입니다." }, { status: 400 });

    const file = await downloadSubmissionFile(num);
    if (!file) return NextResponse.json({ error: "저장된 원본이 없어 다시 평가할 수 없습니다." }, { status: 404 });

    const parsed = await parsePdf(file);
    const report = await evaluateIr(persona, domain, parsed.markedText, {}, "internal");
    report.extractionQuality = assessExtractionQuality(parsed);

    const evaluation = await updateEvaluationReport(num, {
      domainId,
      personaId: persona.id,
      personaName: persona.name,
      report,
    });
    return NextResponse.json({ evaluation });
  } catch (err) {
    console.error("Platform re-evaluation failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "평가 중 오류가 발생했습니다." }, { status: 500 });
  }
}
