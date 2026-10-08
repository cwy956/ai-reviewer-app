import { NextResponse } from "next/server";
import { createUploadTarget } from "@/lib/irUploads";
import { checkSubmissionRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

// 공개 페이지에서 쓰는 라우트 — 큰 PDF를 서버 본문 한도(4.5MB)를 피해 올리기 위한 일회용 업로드 주소 발급.
export async function POST(request: Request) {
  try {
    // 제출 한 건은 여기서 한 번만 센다 — 업로드 주소 없이는 평가(AI 호출)를 시작할 수 없으므로 이 지점이 비용의 관문
    const limit = await checkSubmissionRateLimit(request);
    if (!limit.ok) {
      return NextResponse.json({ error: limit.message }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    return NextResponse.json(await createUploadTarget());
  } catch (err) {
    console.error("Upload URL 발급 실패:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "업로드 준비에 실패했습니다." }, { status: 500 });
  }
}
