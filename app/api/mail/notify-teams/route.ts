import { NextResponse } from "next/server";
import { readBacklogCache } from "@/lib/mail/backlogStore";
import { sendTeamsBacklogDigest } from "@/lib/mail/notifyTeams";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cache = readBacklogCache();
  if (!cache) {
    return NextResponse.json({ error: "아직 처리된 백로그가 없습니다." }, { status: 404 });
  }

  const appUrl = process.env.APP_BASE_URL || new URL(req.url).origin;
  const { reviewer, admin } = await sendTeamsBacklogDigest({
    totalInMailbox: cache.totalInMailbox,
    mails: cache.mails,
    dashboardUrl: `${appUrl}/mailbox`,
  });

  if (!reviewer.ok && !reviewer.skipped && !admin.ok && !admin.skipped) {
    return NextResponse.json({ error: "두 웹훅 모두 전송에 실패했습니다.", reviewer, admin }, { status: 500 });
  }

  return NextResponse.json({ reviewer, admin });
}
