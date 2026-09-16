import { NextResponse } from "next/server";
import { fetchAttachmentContent } from "@/lib/mail/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ msgNum: string; index: string }> }) {
  const { msgNum: msgNumStr, index: indexStr } = await params;
  const msgNum = Number(msgNumStr);
  const index = Number(indexStr);
  if (!Number.isFinite(msgNum) || msgNum <= 0 || !Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const { filename, contentType, content } = await fetchAttachmentContent(msgNum, index);
    const encodedFilename = encodeURIComponent(filename);
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(content.length),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "첨부파일을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
