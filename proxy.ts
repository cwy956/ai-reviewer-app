import { NextResponse, type NextRequest } from "next/server";

// Pages/APIs meant only for our own reviewers/admin, never for the startups using the public
// IR-evaluation page at "/". Gated behind a single shared password entered on /internal-login,
// stored as a plain cookie (httpOnly + secure) — simple, no user accounts, matches the
// "internal tool" scope of this app.
const PROTECTED_PREFIXES = ["/onboarding", "/mailbox", "/dashboard", "/api/onboarding", "/api/mail", "/api/dashboard"];
const AUTH_COOKIE = "internal_auth";

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(req: NextRequest) {
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

  if (req.cookies.get(AUTH_COOKIE)?.value === password) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "내부 전용 페이지입니다. 로그인이 필요합니다." }, { status: 401 });
  }

  const loginUrl = new URL("/internal-login", req.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/onboarding/:path*", "/mailbox/:path*", "/dashboard", "/api/onboarding/:path*", "/api/mail/:path*", "/api/dashboard"],
};
