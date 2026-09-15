import { NextResponse } from "next/server";
import { readBacklogCache } from "@/lib/mail/backlogStore";

export const runtime = "nodejs";

export async function GET() {
  const cache = await readBacklogCache();
  if (!cache) {
    return NextResponse.json(
      { error: "아직 전체 백로그가 처리되지 않았습니다. `/mailbox`에서 '전체 백로그 처리 시작'을 눌러주세요." },
      { status: 404 }
    );
  }
  return NextResponse.json(cache);
}
