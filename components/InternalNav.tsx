"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/internal", label: "HOME", match: (p) => p === "/internal" || p.startsWith("/dashboard") },
  { href: "/ir-deals", label: "IR 딜", match: (p) => p.startsWith("/ir-deals") },
  { href: "/mailbox/sent", label: "메일 발송 이력", match: (p) => p.startsWith("/mailbox") },
  { href: "/onboarding", label: "담당자 관리", match: (p) => p.startsWith("/onboarding") },
];

/** 직원 플랫폼 공통 상단 메뉴 — 흰 바탕에 안다 CI 로고, 일반 홈페이지처럼 어느 화면에서든 한 번에 이동. */
export function InternalNav() {
  const pathname = usePathname() ?? "";

  async function logout() {
    await fetch("/api/internal-login", { method: "DELETE" }).catch(() => {});
    window.location.href = "/internal-login";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-panel-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-4">
        <Link href="/internal" aria-label="안다아시아벤처스 홈" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/anda-ci.svg" alt="ANDA ASIA VENTURES" className="h-12 w-auto" />
        </Link>

        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MENU.map((m) => {
            const active = m.match(pathname);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`relative whitespace-nowrap px-3 py-7 font-medium transition ${
                  active ? "text-accent" : "text-foreground/65 hover:text-accent"
                }`}
              >
                {m.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-4 text-xs text-muted">
          <Link href="/" className="hidden hover:text-accent lg:inline">
            기업용 페이지 ↗
          </Link>
          <button onClick={logout} className="hover:text-accent">
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
