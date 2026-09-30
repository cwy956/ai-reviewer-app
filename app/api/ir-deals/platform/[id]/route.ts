import { NextResponse } from "next/server";
import { getPlatformSubmission } from "@/lib/evaluations/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  try {
    const submission = await getPlatformSubmission(num);
    if (!submission) {
      return NextResponse.json({ error: "제출을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ submission });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
