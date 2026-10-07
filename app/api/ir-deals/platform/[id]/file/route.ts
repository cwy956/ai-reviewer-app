import { NextResponse } from "next/server";
import { downloadSubmissionFile } from "@/lib/irUploads";

export const runtime = "nodejs";

// 내부 전용(/api/ir-deals 하위라 proxy.ts의 로그인 게이트 적용) — 플랫폼으로 제출된 IR 원본 PDF.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const file = await downloadSubmissionFile(num);
  if (!file) return NextResponse.json({ error: "저장된 원본이 없습니다." }, { status: 404 });
  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, max-age=300" },
  });
}
