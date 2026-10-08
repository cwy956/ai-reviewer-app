import Link from "next/link";

/**
 * 직원 플랫폼 상단(InternalNav)과 같은 배치 — 왼쪽 CI 로고, 오른쪽 페이지 이동 링크.
 * 투자기업용 페이지와 직원 로그인 화면에서 공통으로 사용.
 */
export function PublicHeader({ linkHref, linkLabel }: { linkHref: string; linkLabel: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-panel-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-4">
        <Link href="/" aria-label="안다아시아벤처스" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/anda-ci.svg" alt="ANDA ASIA VENTURES" className="h-12 w-auto" />
        </Link>
        <Link href={linkHref} prefetch={false} className="shrink-0 text-xs text-muted hover:text-accent">
          {linkLabel} ↗
        </Link>
      </div>
    </header>
  );
}
