import { NextResponse } from "next/server";

export const runtime = "nodejs";

// TEMPORARY diagnostic route — confirms whether this running server process can see
// ANTHROPIC_API_KEY, without exposing the actual secret. Delete once the deploy issue is fixed.
export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({
    hasAnthropicKey: Boolean(key),
    length: key?.length ?? 0,
    prefix: key ? key.slice(0, 12) : null,
    hasMailHost: Boolean(process.env.MAIL_HOST),
    nodeEnv: process.env.NODE_ENV,
  });
}
