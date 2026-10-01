import { NextResponse } from "next/server";
import { fetchMessageForForwarding } from "@/lib/mail/client";

// TEMPORARY — inspect the raw HTML around a download link to debug uBlock popup blocking.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const msgNum = Number(searchParams.get("msgNum"));
  const full = await fetchMessageForForwarding(msgNum);
  const html = full.html ?? "(html 없음)";
  const idx = html.indexOf("daum.net");
  const snippet = idx >= 0 ? html.slice(Math.max(0, idx - 800), idx + 400) : html.slice(0, 1200);
  return NextResponse.json({ htmlLength: html.length, snippet });
}
