import { NextResponse } from "next/server";
import { readSendLog } from "@/lib/mail/sendLogStore";

export const runtime = "nodejs";

export async function GET() {
  const entries = readSendLog().slice().reverse(); // newest first
  return NextResponse.json({ entries });
}
