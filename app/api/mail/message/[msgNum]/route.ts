import { NextResponse } from "next/server";
import { fetchFullMessage } from "@/lib/mail/client";
import { getCachedMessage, setCachedMessage } from "@/lib/mail/messageCache";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(_req: Request, { params }: { params: Promise<{ msgNum: string }> }) {
  const { msgNum } = await params;
  const num = Number(msgNum);
  if (!Number.isFinite(num) || num <= 0) {
    return NextResponse.json({ error: "잘못된 메일 번호입니다." }, { status: 400 });
  }

  try {
    // 팀 전체가 공유하는 캐시 — 메일 내용은 한 번 도착하면 안 바뀌므로, 누가 먼저 열었든 그
    // 이후로는 아무도 POP3를 다시 안 타도 됨 (브라우저 탭별 캐시와 달리 사람이 달라도 적용됨).
    const cached = await getCachedMessage(num);
    if (cached) return NextResponse.json(cached);

    const mail = await fetchFullMessage(num, { includeAttachmentContent: true });
    await setCachedMessage(num, mail);
    return NextResponse.json(mail);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "메일을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
