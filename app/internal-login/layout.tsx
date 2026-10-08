import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "관리자 로그인 | 안다아시아벤처스" },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
