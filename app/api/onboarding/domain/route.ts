import { NextResponse } from "next/server";
import { upsertDomainCriteria } from "@/lib/personas/store";

export const runtime = "nodejs";

interface DomainCriteriaBody {
  personaId: string;
  domainId: string;
  starredCheckpointIds: string[];
  freeform: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DomainCriteriaBody;

    if (!body.personaId || !body.domainId) {
      return NextResponse.json({ error: "personaId, domainId는 필수입니다." }, { status: 400 });
    }

    const persona = await upsertDomainCriteria(body.personaId, {
      domainId: body.domainId,
      starredCheckpointIds: body.starredCheckpointIds ?? [],
      freeform: body.freeform ?? "",
    });

    return NextResponse.json({ persona });
  } catch (err) {
    const message = err instanceof Error ? err.message : "저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
