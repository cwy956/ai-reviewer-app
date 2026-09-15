import { NextResponse } from "next/server";
import { checkForNewMail, sendTestAlert } from "@/lib/mail/watcher";
import { readWatchState } from "@/lib/mail/watchStore";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Status of the background watcher — for the dashboard to display. */
export async function GET() {
  return NextResponse.json({ state: await readWatchState() });
}

/**
 * Forces one check-and-maybe-alert cycle immediately, without waiting for the interval timer.
 * Pass ?test=1 (optionally &count=N, default 5) to force-send a real email alert using the
 * newest N mails right now, without touching the real watch-state baseline — for demos/testing.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("test") === "1") {
    const count = Math.max(1, Math.min(50, Number(searchParams.get("count")) || 5));
    const result = await sendTestAlert(count);
    return NextResponse.json(result);
  }

  const result = await checkForNewMail();
  return NextResponse.json(result);
}
