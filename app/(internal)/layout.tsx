import type { Metadata } from "next";
import { InternalNav } from "@/components/InternalNav";

export const metadata: Metadata = {
  title: { template: "%s | 안다아시아벤처스 관리자", default: "안다아시아벤처스 관리자" },
  description: "안다아시아벤처스 직원 전용 — 문의 메일 분류와 IR 검토를 한곳에서 관리합니다.",
  robots: { index: false, follow: false }, // 내부 도구는 검색 결과에 노출되지 않게
};

// 직원 플랫폼(로그인 필요한 화면) 공통 레이아웃 — 상단 메뉴 + 각 화면.
// 기업용 공개 페이지("/")와 로그인 화면은 이 그룹 밖에 있어 메뉴가 붙지 않음.
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InternalNav />
      {children}
    </>
  );
}
