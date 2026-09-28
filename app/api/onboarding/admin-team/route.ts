import { NextResponse } from "next/server";
import { addAdminTeamMember, listAdminTeamMembers, removeAdminTeamMember } from "@/lib/adminTeam/store";

export async function GET() {
  try {
    const members = await listAdminTeamMembers();
    return NextResponse.json({ members });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!name || !email) {
      return NextResponse.json({ error: "이름과 이메일을 모두 입력해 주세요." }, { status: 400 });
    }
    const member = await addAdminTeamMember({ name, email });
    return NextResponse.json({ member });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "등록에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }
    await removeAdminTeamMember(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "삭제에 실패했습니다." }, { status: 500 });
  }
}
