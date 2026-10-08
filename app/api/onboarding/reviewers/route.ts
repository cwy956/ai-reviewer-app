import { NextResponse } from "next/server";
import { deletePersona, listPersonas, upsertPersonaBase } from "@/lib/personas/store";

export const runtime = "nodejs";

// 투자팀(심사역) 등록 — 관리팀과 같은 흐름: 이름 + 이메일만. 영역 설정은 없음(AI 심사역이 모든 영역을 맡고,
// 투자 관련 메일은 등록된 심사역 전원에게 발송됨 — lib/mail/routing.ts).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeId(email: string): string {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "reviewer";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function GET() {
  try {
    const personas = (await listPersonas()).filter((p) => !p.isDefault);
    return NextResponse.json({ reviewers: personas.map((p) => ({ id: p.id, name: p.name, email: p.email ?? "" })) });
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

    const persona = await upsertPersonaBase({
      id: makeId(email),
      name,
      affiliation: "안다아시아벤처스",
      bio: "",
      email,
      portfolio: [],
      isDefault: false,
    });
    return NextResponse.json({ reviewer: { id: persona.id, name: persona.name, email: persona.email ?? "" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "등록에 실패했습니다." }, { status: 500 });
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
