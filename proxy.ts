import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, SESSION_SECONDS, checkSession } from "@/lib/internalAuth";

// Pages/APIs meant only for our own reviewers/admin, never for the startups using the public
// IR-evaluation page at "/". Gated behind a single shared password entered on /internal-login;
// 로그인하면 서명된 세션 쿠키가 발급됨(활동 없이 2시간, 최대 12시간) — 비밀번호 자체는 쿠키에 저장하지 않음(lib/internalAuth.ts).
// 새 내부 페이지/API를 만들면 아래 두 목록(PROTECTED_PREFIXES, matcher)에 반드시 추가할 것.
const PROTECTED_PREFIXES = [
  "/internal",
  "/onboarding",
  "/mailbox",
  "/dashboard",
  "/ir-deals",
  "/api/onboarding",
  "/api/mail",
  "/api/dashboard",
  "/api/ir-deals",
  "/api/site-analytics",
  "/api/personas",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const password = process.env.INTERNAL_ACCESS_PASSWORD;
  if (!password) {
    // Production with no password configured must fail CLOSED — otherwise these pages would
    // silently be wide open to anyone who finds the URL (exactly what this proxy exists
    // to prevent). Local dev fails open so running the app without setting this up stays easy.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("내부 도구 접근 비밀번호(INTERNAL_ACCESS_PASSWORD)가 설정되지 않았습니다.", { status: 503 });
    }
    return NextResponse.next();
  }

  const session = await checkSession(req.cookies.get(AUTH_COOKIE)?.value, password);
  if (session.valid) {
    const res = NextResponse.next();
    // 사용 중이면 만료를 계속 뒤로 미룸(활동 없이 2시간이 지나야 만료)
    if (session.renewedToken) {
      res.cookies.set(AUTH_COOKIE, session.renewedToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_SECONDS,
      });
    }
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "내부 전용 페이지입니다. 로그인이 필요합니다." }, { status: 401 });
  }

  const loginUrl = new URL("/internal-login", req.url);
  loginUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/internal",
    "/onboarding/:path*",
    "/mailbox/:path*",
    "/dashboard",
    "/ir-deals",
    "/api/onboarding/:path*",
    "/api/mail/:path*",
    "/api/dashboard",
    "/api/ir-deals/:path*",
    "/api/site-analytics",
    "/api/personas",
  ],
};
