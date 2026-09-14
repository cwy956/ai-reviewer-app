import { NextResponse } from "next/server";

export const runtime = "nodejs";

// TEMPORARY diagnostic route — confirms whether this running server process can see our
// configured env vars, without exposing any secret values. Delete once the deploy issue is fixed.
export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;
  const matchingKeys = Object.keys(process.env)
    .filter((k) => /anthropic|mail|teams|app_base/i.test(k))
    .sort();

  return NextResponse.json({
    hasAnthropicKey: Boolean(key),
    length: key?.length ?? 0,
    prefix: key ? key.slice(0, 12) : null,
    hasMailHost: Boolean(process.env.MAIL_HOST),
    nodeEnv: process.env.NODE_ENV,
    // Exact env var names this process actually sees (values not included) — reveals typos,
    // stray whitespace, or wrong casing that wouldn't otherwise be visible.
    matchingEnvVarNames: matchingKeys,
    totalEnvVarCount: Object.keys(process.env).length,
  });
}
