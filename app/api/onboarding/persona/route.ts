import { NextResponse } from "next/server";
import { upsertPersonaBase } from "@/lib/personas/store";
import type { Persona } from "@/lib/personas/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Omit<Persona, "domainCriteria">;

    if (!body.id || !body.name || !body.affiliation) {
      return NextResponse.json({ error: "id, name, affiliation은 필수입니다." }, { status: 400 });
    }

    const persona = upsertPersonaBase({
      id: body.id,
      name: body.name,
      affiliation: body.affiliation,
      bio: body.bio ?? "",
      portfolio: body.portfolio ?? [],
      isDefault: false,
      sevenPrinciples: body.sevenPrinciples,
    });

    return NextResponse.json({ persona });
  } catch (err) {
    const message = err instanceof Error ? err.message : "저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
