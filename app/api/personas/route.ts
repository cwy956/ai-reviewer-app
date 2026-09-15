import { NextResponse } from "next/server";
import { listPersonas } from "@/lib/personas/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ personas: await listPersonas() });
}
