import { NextResponse } from "next/server";
import { readBacklogCache } from "@/lib/mail/backlogStore";

export const runtime = "nodejs";

export async function GET() {
  const cache = readBacklogCache();
  if (!cache) {
    return NextResponse.json(
      { error: "아직 전체 백로그가 처리되지 않았습니다. `npx tsx scripts/classify-backlog.ts`를 실행해 주세요." },
      { status: 404 }
    );
  }
  return NextResponse.json(cache);
}
