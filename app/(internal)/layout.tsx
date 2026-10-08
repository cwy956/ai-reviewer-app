import { InternalNav } from "@/components/InternalNav";

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
