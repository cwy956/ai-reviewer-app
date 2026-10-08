import { NextResponse } from "next/server";
import { deletePersona, getPersonaById, listPersonas, setPersonaDomains, upsertPersonaBase } from "@/lib/personas/store";
import { getDomain } from "@/lib/domains";

export const runtime = "nodejs";

// 담당자 관리(심사역) 간단 등록용 — 이름·이메일·담당 영역만 받음. 관리팀 등록과 같은 흐름.
// (예전의 7항목 판단 기준·영역별 체크포인트 입력은 이 화면에서 받지 않음. 기존에 저장된 값은 건드리지 않고 유지.)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublic(p: Awaited<ReturnType<typeof listPersonas>>[number]) {
  return { id: p.id, name: p.name, email: p.email ?? "", domainIds: p.domainCriteria.map((c) => c.domainId) };
}

function cleanDomainIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((v): v is string => typeof v === "string" && Boolean(getDomain(v)))));
}

function makeId(email: string): string {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "reviewer";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function GET() {
  try {
    const personas = (await listPersonas()).filter((p) => !p.isDefault);
    return NextResponse.json({ reviewers: personas.map(toPublic) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!name || !email) return NextResponse.json({ error: "이름과 이메일을 모두 입력해 주세요." }, { status: 400 });
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });

    const id = makeId(email);
    await upsertPersonaBase({ id, name, affiliation: "안다아시아벤처스", bio: "", email, portfolio: [], isDefault: false });
    const persona = await setPersonaDomains(id, cleanDomainIds(body.domainIds));
    return NextResponse.json({ reviewer: toPublic(persona) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "등록에 실패했습니다." }, { status: 500 });
  }
}

// 담당 영역(과 필요하면 이름·이메일) 수정
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const existing = id ? await getPersonaById(id) : undefined;
    if (!existing || existing.isDefault) return NextResponse.json({ error: "담당자를 찾을 수 없습니다." }, { status: 404 });

    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name;
    const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : existing.email;
    if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });

    if (name !== existing.name || email !== existing.email) {
      await upsertPersonaBase({
        id: existing.id,
        name,
        affiliation: existing.affiliation,
        bio: existing.bio,
        email,
        portfolio: existing.portfolio,
        isDefault: false,
        sevenPrinciples: existing.sevenPrinciples,
      });
    }
    const persona = Array.isArray(body.domainIds) ? await setPersonaDomains(id, cleanDomainIds(body.domainIds)) : await getPersonaById(id);
    return NextResponse.json({ reviewer: toPublic(persona!) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "수정에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    await deletePersona(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "삭제에 실패했습니다." }, { status: 500 });
  }
}
