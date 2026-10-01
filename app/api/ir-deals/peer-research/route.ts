import { NextResponse } from "next/server";
import { getEvaluationById, updatePeerResearch } from "@/lib/evaluations/store";
import { buildCompanyDescription, researchPeers } from "@/lib/peerResearch";

export const runtime = "nodejs";
// 웹 검색(최대 6회) + 2번의 Claude 호출 — 자료 평가보다 가볍지만 검색 횟수에 따라 변동이 커서
// 넉넉하게 잡음.
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const evaluationId = Number(body.evaluationId);
    const dealTitle = typeof body.dealTitle === "string" ? body.dealTitle : "";
    const domainLabel = typeof body.domainLabel === "string" ? body.domainLabel : "";

    if (!Number.isFinite(evaluationId) || !dealTitle || !domainLabel) {
      return NextResponse.json({ error: "필수 값이 누락되었습니다." }, { status: 400 });
    }

    const evaluation = await getEvaluationById(evaluationId);
    if (!evaluation) {
      return NextResponse.json({ error: "평가 결과를 찾을 수 없습니다." }, { status: 404 });
    }

    const companyDescription = buildCompanyDescription(dealTitle, domainLabel, evaluation.report);
    const peerResearch = await researchPeers(companyDescription, domainLabel);
    await updatePeerResearch(evaluationId, peerResearch);

    return NextResponse.json({ peerResearch });
  } catch (err) {
    console.error("Peer research failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "리서치 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
