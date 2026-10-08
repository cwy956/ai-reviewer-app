import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, SESSION_SECONDS, createSessionToken } from "@/lib/internalAuth";

export const runtime = "nodejs";

// 비밀번호 무차별 대입 방지 — IP당 10분에 5번까지 실패 허용. 서버리스 인스턴스 메모리 기준이라 완벽하진 않지만
// 한 인스턴스에 몰리는 단순 대입 공격은 막고, 비밀번호를 길게 쓰면 나머지는 충분히 어려워짐.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function wrongPasswordMessage(remaining: number): string {
  if (remaining === 1) return "비밀번호가 올바르지 않아요. ⚠ 마지막 기회예요. 한 번 더 틀리면 10분간 잠겨요.";
  if (remaining === 2) return "비밀번호가 올바르지 않아요. ⚠ 남은 시도 2회, 모두 틀리면 10분간 잠겨요.";
  return `비밀번호가 올바르지 않아요. (남은 시도 ${remaining}회)`;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const now = Date.now();
  const rec = fails.get(ip);
  if (rec && rec.resetAt > now && rec.count >= MAX_FAILS) {
    const minutes = Math.max(1, Math.ceil((rec.resetAt - now) / 60000));
    return NextResponse.json(
      { error: `비밀번호를 ${MAX_FAILS}번 틀려서 잠겼어요. ${minutes}분 뒤에 다시 시도해 주세요.`, locked: true },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const expected = process.env.INTERNAL_ACCESS_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "서버에 내부 접근 비밀번호가 설정되지 않았습니다." }, { status: 503 });
  }
  if (!passwordMatches(password, expected)) {
    const next = rec && rec.resetAt > now ? { count: rec.count + 1, resetAt: rec.resetAt } : { count: 1, resetAt: now + WINDOW_MS };
    fails.set(ip, next);
    const remaining = MAX_FAILS - next.count;
    if (remaining <= 0) {
      return NextResponse.json(
        { error: `비밀번호를 ${MAX_FAILS}번 틀려서 10분간 잠겼어요. 잠시 후 다시 시도해 주세요.`, locked: true },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: wrongPasswordMessage(remaining), remaining }, { status: 401 });
  }

  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await createSessionToken(expected), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return res;
}

// 로그아웃 — 쿠키 삭제
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
