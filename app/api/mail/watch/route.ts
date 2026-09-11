import { NextResponse } from "next/server";
import { checkForNewMail } from "@/lib/mail/watcher";
import { readWatchState } from "@/lib/mail/watchStore";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Status of the background watcher — for the dashboard to display. */
export async function GET() {
  return NextResponse.json({ state: readWatchState() });
}

/** Forces one check-and-maybe-alert cycle immediately, without waiting for the interval timer. */
export async function POST() {
  const result = await checkForNewMail();
  return NextResponse.json(result);
}
