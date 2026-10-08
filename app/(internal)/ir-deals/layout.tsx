import type { Metadata } from "next";

export const metadata: Metadata = { title: "딜 리스트" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
