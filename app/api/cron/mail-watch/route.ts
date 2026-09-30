import { NextResponse } from "next/server";
import { checkForNewMail } from "@/lib/mail/watcher";

export const runtime = "nodejs";
// checkForNewMail now auto-evaluates every newly-classified IR mail (AI 평가 ~1~2분/건,
// sequential) after alerts are sent — 300 is Vercel's hard ceiling on Hobby+Fluid Compute.
export const maxDuration = 300;

/**
 * Vercel Cron hits this with GET once a day (see vercel.json). If CRON_SECRET is set as a
 * project env var, Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` on
 * cron-triggered requests — we verify it here so this endpoint can't be triggered by anyone
 * who just guesses the URL. Leave CRON_SECRET unset to skip that check (still works, just open).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await checkForNewMail();
  return NextResponse.json(result);
}
