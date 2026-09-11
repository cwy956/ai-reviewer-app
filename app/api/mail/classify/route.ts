import { NextResponse } from "next/server";
import { fetchRecentMailSummaries, countMessages } from "@/lib/mail/client";
import { classifyMails } from "@/lib/mail/classify";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_LIMIT = 300;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requested = Number(searchParams.get("limit") ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 50, 1), MAX_LIMIT);

    const [summaries, total] = await Promise.all([fetchRecentMailSummaries(limit), countMessages()]);
    const classified = await classifyMails(summaries);

    return NextResponse.json({ mails: classified, fetched: summaries.length, total });
  } catch (err) {
    console.error("Mail classify failed:", err);
    const message = err instanceof Error ? err.message : "메일 분류 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
