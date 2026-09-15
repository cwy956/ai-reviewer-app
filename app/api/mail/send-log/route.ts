import { NextResponse } from "next/server";
import { readSendLog } from "@/lib/mail/sendLogStore";

export const runtime = "nodejs";

export async function GET() {
  const entries = await readSendLog(); // already newest-first
  return NextResponse.json({ entries });
}
