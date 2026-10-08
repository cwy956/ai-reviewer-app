import { NextResponse } from "next/server";
import { checkForNewMail } from "@/lib/mail/watcher";
import { fillMissingPlatformInvestment } from "@/lib/evaluations/fillMissing";

export const runtime = "nodejs";
// checkForNewMail now auto-evaluates every newly-classified IR mail (AI 평가 ~1~2분/건,
// sequential) after alerts are sent — 300 is Vercel's hard ceiling on Hobby+Fluid Compute.
export const maxDuration = 300;

/**
 * Vercel Cron hits this with GET once a day (see vercel.json). If CRON_SECRET is set as a
 * project env var, Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` on
 * cron-triggered requests — we verify it here so this endpoint can't be triggered by anyone
 * who just guesses the URL. 운영에서는 CRON_SECRET이 반드시 있어야 동작함(없으면 503).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // 운영에서 시크릿이 없으면 누구나 메일함 확인·AI 평가·알림 발송을 일으킬 수 있으므로 거부. 로컬 개발에서만 열어 둠.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET이 설정되지 않았습니다." }, { status: 503 });
    }
  } else if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const result = await checkForNewMail();
  // 메일 처리에 시간이 많이 안 걸렸을 때만, 플랫폼 제출 중 투자 매력도가 빠진 건을 채움(실패해도 크론 결과에는 영향 없음)
  let filledPlatform: number[] = [];
  if (Date.now() - startedAt < 120_000) {
    try {
      filledPlatform = (await fillMissingPlatformInvestment(1)).filled;
    } catch (err) {
      console.error("[cron] 플랫폼 투자 매력도 보강 실패:", err);
    }
  }
  return NextResponse.json({ ...result, filledPlatform });
}
