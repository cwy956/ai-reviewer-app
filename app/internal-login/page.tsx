"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";

function InternalLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 같은 사이트 안의 경로만 허용 (//evil.com 같은 외부 주소로 보내는 오픈 리다이렉트 방지)
  const requested = searchParams.get("redirect") || "/internal";
  const redirect = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/internal";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLocked(false);
    try {
      const res = await fetch("/api/internal-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.locked) setLocked(true);
        throw new Error(data.error || "로그인에 실패했습니다.");
      }
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <PublicHeader linkHref="/" linkLabel="투자기업 페이지 이동" />
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-xl font-bold text-accent-soft">안다아시아벤처스 직원 로그인</h1>
      <p className="mb-6 text-sm text-muted">
        메일함 분류·대시보드 등 내부 도구는 직원 전용이에요. 공유받은 비밀번호를 입력해주세요.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoFocus
          className="w-full rounded-lg border border-panel-border bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
        />
        {error && (
          <p className={locked ? "rounded-lg border border-bad/30 bg-bad/5 px-3 py-2.5 text-sm font-medium text-bad" : "text-sm text-bad"}>
            {locked ? "🔒 " : ""}
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "확인 중..." : "들어가기"}
        </button>
      </form>
    </main>
    </>
  );
}

export default function InternalLoginPage() {
  return (
    <Suspense fallback={null}>
      <InternalLoginForm />
    </Suspense>
  );
}
