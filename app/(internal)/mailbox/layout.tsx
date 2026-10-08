import type { Metadata } from "next";

export const metadata: Metadata = { title: "메일 발송 이력" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
