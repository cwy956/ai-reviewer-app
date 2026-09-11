import { NextResponse } from "next/server";
import { fetchFullMessage } from "@/lib/mail/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ msgNum: string }> }) {
  const { msgNum } = await params;
  const num = Number(msgNum);
  if (!Number.isFinite(num) || num <= 0) {
    return NextResponse.json({ error: "잘못된 메일 번호입니다." }, { status: 400 });
  }

  try {
    const mail = await fetchFullMessage(num);
    return NextResponse.json(mail);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "메일을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
