import { NextResponse } from "next/server";
import { AnalyticsNotConfiguredError, getSiteAnalytics } from "@/lib/siteAnalytics";

export const runtime = "nodejs";

// 내부 전용(proxy.ts 로그인 게이트) — 홈페이지 방문 현황. 연동 전이면 notConfigured로 응답해 화면이 "준비 중"을 보여줌.
export async function GET() {
  try {
    return NextResponse.json({ analytics: await getSiteAnalytics() });
  } catch (err) {
    if (err instanceof AnalyticsNotConfiguredError) {
      return NextResponse.json({ notConfigured: true });
    }
    console.error("[site-analytics] 조회 실패:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "방문 현황을 불러오지 못했습니다." },
      { status: 502 }
    );
  }
}
