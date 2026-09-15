import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "internal_auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.INTERNAL_ACCESS_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "서버에 내부 접근 비밀번호가 설정되지 않았습니다." }, { status: 503 });
  }
  if (password !== expected) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, expected, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
