import { NextResponse } from "next/server";
import { listEvaluationsForMail } from "@/lib/mail/evaluationStore";

export async function GET(_req: Request, { params }: { params: Promise<{ msgNum: string }> }) {
  const { msgNum } = await params;
  const num = Number(msgNum);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "잘못된 메일 번호입니다." }, { status: 400 });
  }
  try {
    const evaluations = await listEvaluationsForMail(num);
    return NextResponse.json({ evaluations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
