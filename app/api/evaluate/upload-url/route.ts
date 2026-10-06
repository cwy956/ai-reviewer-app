import { NextResponse } from "next/server";
import { createUploadTarget } from "@/lib/irUploads";

export const runtime = "nodejs";

// 공개 페이지에서 쓰는 라우트 — 큰 PDF를 서버 본문 한도(4.5MB)를 피해 올리기 위한 일회용 업로드 주소 발급.
export async function POST() {
  try {
    return NextResponse.json(await createUploadTarget());
  } catch (err) {
    console.error("Upload URL 발급 실패:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "업로드 준비에 실패했습니다." }, { status: 500 });
  }
}
