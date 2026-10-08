import type { Metadata } from "next";

export const metadata: Metadata = { title: "IR 딜" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
