"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/internal", label: "HOME", match: (p) => p === "/internal" },
  { href: "/ir-deals", label: "IR 딜", match: (p) => p.startsWith("/ir-deals") },
  { href: "/dashboard", label: "대시보드", match: (p) => p.startsWith("/dashboard") },
  { href: "/mailbox/sent", label: "메일 발송 이력", match: (p) => p.startsWith("/mailbox") },
  { href: "/onboarding", label: "심사역 관리", match: (p) => p.startsWith("/onboarding") },
];

/** 직원 플랫폼 공통 상단 메뉴 — 일반 홈페이지처럼 어느 화면에서든 한 번에 이동. */
export function InternalNav() {
  const pathname = usePathname() ?? "";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-accent text-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4">
        <Link href="/internal" className="flex shrink-0 items-baseline gap-2">
          <span className="text-sm font-bold tracking-wide">ANDA ASIA VENTURES</span>
          <span className="hidden text-xs text-white/70 sm:inline">AI 심사역</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MENU.map((m) => {
            const active = m.match(pathname);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition ${
                  active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        <Link href="/" className="hidden shrink-0 text-xs text-white/60 hover:text-white lg:inline">
          기업용 페이지 ↗
        </Link>
      </div>
    </header>
  );
}
