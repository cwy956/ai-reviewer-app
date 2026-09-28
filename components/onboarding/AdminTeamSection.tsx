"use client";

import { useEffect, useState } from "react";
import type { AdminTeamMember } from "@/lib/adminTeam/schema";

export function AdminTeamSection() {
  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/onboarding/admin-team")
      .then((res) => res.json())
      .then((data) => setMembers(data.members ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/admin-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록에 실패했습니다.");
      setName("");
      setEmail("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/admin-team?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "삭제에 실패했습니다.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    }
  }

  return (
    <section className="mt-10 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-muted">관리팀 구성원</h2>
        <p className="mt-1 text-xs text-muted">
          정부지원사업·협업제안·기타 메일은 심사역이 아니라 여기 등록된 관리팀 전원에게 발송돼요.
        </p>
      </div>

      {loading && <p className="text-sm text-muted">불러오는 중...</p>}

      {!loading && (
        <div className="space-y-2">
          {members.length === 0 && (
            <p className="rounded-lg border border-dashed border-panel-border p-4 text-center text-sm text-muted">
              등록된 관리팀 구성원이 없어요. 아래에서 추가해 주세요.
            </p>
          )}
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-panel-border bg-panel p-3"
            >
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted">{m.email}</p>
              </div>
              <button
                onClick={() => handleRemove(m.id)}
                className="text-xs text-muted hover:text-bad"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-lg border border-panel-border bg-panel p-3">
        <div className="flex-1 min-w-[120px]">
          <label className="mb-1 block text-xs text-muted">이름</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs text-muted">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@andaasiavc.com"
            className="w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !name.trim() || !email.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          추가
        </button>
      </form>
      {error && <p className="text-xs text-bad">{error}</p>}
    </section>
  );
}
