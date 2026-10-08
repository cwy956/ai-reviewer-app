import { redirect } from "next/navigation";

// 대시보드는 직원 홈(/internal)으로 통합됨 — 예전 북마크·링크가 깨지지 않게 리다이렉트만 남김.
export default function DashboardRedirect() {
  redirect("/internal");
}
