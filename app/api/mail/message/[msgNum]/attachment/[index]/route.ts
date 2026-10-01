import { NextResponse } from "next/server";
import { fetchAttachmentContent } from "@/lib/mail/client";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request, { params }: { params: Promise<{ msgNum: string; index: string }> }) {
  const { msgNum: msgNumStr, index: indexStr } = await params;
  const msgNum = Number(msgNumStr);
  const index = Number(indexStr);
  if (!Number.isFinite(msgNum) || msgNum <= 0 || !Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  // ?inline=1 renders in-browser (e.g. a PDF preview embedded in an <iframe>) instead of
  // forcing a download — same bytes, just a different Content-Disposition.
  const inline = new URL(req.url).searchParams.get("inline") === "1";

  try {
    const { filename, contentType, content } = await fetchAttachmentContent(msgNum, index);
    const encodedFilename = encodeURIComponent(filename);
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
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
