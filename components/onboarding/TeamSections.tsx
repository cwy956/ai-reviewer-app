"use client";

import { useEffect, useState } from "react";

// 담당자 관리 — 투자팀(심사역)과 관리팀을 완전히 같은 모양·같은 절차(이름 + 이메일)로 등록.
// 각 섹션 맨 위에 "어떤 메일이 이 팀에게 발송되는지"를 적어 둠.

interface Member {
  id: string;
  name: string;
  email: string;
}

const inputClass =
  "w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

function MemberSection({
  title,
  description,
  badge,
  endpoint,
  listKey,
  emptyText,
}: {
  title: string;
  description: string;
  /** 구성원 카드에 붙는 "받는 메일" 칩 */
  badge: string;
  endpoint: string;
  /** 목록 조회 응답에서 배열이 들어 있는 키 */
  listKey: "reviewers" | "members";
  emptyText: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => setMembers(d[listKey] ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
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

  async function handleRemove(m: Member) {
    if (!window.confirm(`${m.name}님을 삭제할까요?`)) return;
    setError(null);
    try {
      const res = await fetch(`${endpoint}?id=${encodeURIComponent(m.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "삭제에 실패했습니다.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    }
  }

  return (
    <section className="rounded-xl border border-panel-border bg-panel p-5 shadow-sm">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <span className="rounded-full bg-accent-tint px-2 py-0.5 text-xs font-medium text-accent-soft">{members.length}명</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
      </div>

      <div className="space-y-2">
        {loading && <p className="text-sm text-muted">불러오는 중...</p>}
        {!loading && members.length === 0 && (
          <p className="rounded-lg border border-dashed border-panel-border p-4 text-center text-sm text-muted">{emptyText}</p>
        )}
        {members.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-panel-border bg-background p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{m.name}</p>
              <p className="text-xs text-muted">{m.email || "이메일 없음 — 메일을 받으려면 이메일이 필요해요"}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] text-accent-soft">{badge}</span>
              </div>
            </div>
            <button onClick={() => handleRemove(m)} className="shrink-0 text-xs text-muted hover:text-bad">
              삭제
            </button>
          </div>
        ))}

        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-lg border border-panel-border bg-background p-3">
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block text-xs text-muted">이름</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className={inputClass} />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-muted">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@andaasiavc.com"
              className={inputClass}
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
      </div>
    </section>
  );
}

export function ReviewerSection() {
  return (
    <MemberSection
      title="투자팀 (심사역)"
      description="IR 메일(AI 평가 결과 포함)과 데모데이·LP/출자 참여 등 투자 관련 메일이 등록된 심사역 전원에게 발송돼요."
      badge="투자 메일 전체"
      endpoint="/api/onboarding/reviewers"
      listKey="reviewers"
      emptyText="등록된 심사역이 없어요. 아래에서 추가해 주세요."
    />
  );
}

export function AdminSection() {
  return (
    <MemberSection
      title="관리팀"
      description="정부지원사업·협업제안·사무공간 제휴 등 관리 메일이 등록된 관리팀 전원에게 발송돼요. 등록된 심사역이 없으면 IR 메일도 이쪽으로 가요."
      badge="관리 메일 전체"
      endpoint="/api/onboarding/admin-team"
      listKey="members"
      emptyText="등록된 관리팀 구성원이 없어요. 아래에서 추가해 주세요."
    />
  );
}
