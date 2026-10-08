"use client";

import { useEffect, useState } from "react";
import { domainCategories } from "@/lib/domains";
import type { AdminTeamMember } from "@/lib/adminTeam/schema";

// 담당자 관리 — 투자팀(심사역)과 관리팀을 똑같은 모양·같은 중요도로 보여줌.
// 각 섹션 맨 위에 "어떤 메일이 이 팀에게 발송되는지"를 적어 둠.

interface Reviewer {
  id: string;
  name: string;
  email: string;
  domainIds: string[];
}

const domainLabelById = new Map(domainCategories.flatMap((c) => c.domains.map((d) => [d.id, d.label] as const)));

const inputClass =
  "w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

function SectionShell({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count: number;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-panel-border bg-panel p-5 shadow-sm">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <span className="rounded-full bg-accent-tint px-2 py-0.5 text-xs font-medium text-accent-soft">{count}명</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** 대분류별로 묶은 담당 영역 체크 목록 */
function DomainChecklist({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const selected = new Set(value);
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  }
  function toggleCategory(ids: string[], allOn: boolean) {
    const next = new Set(selected);
    for (const id of ids) {
      if (allOn) next.delete(id);
      else next.add(id);
    }
    onChange(Array.from(next));
  }
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-panel-border bg-background p-3">
      {domainCategories.map((cat) => {
        const ids = cat.domains.map((d) => d.id);
        const allOn = ids.every((id) => selected.has(id));
        return (
          <div key={cat.categoryId}>
            <button
              type="button"
              onClick={() => toggleCategory(ids, allOn)}
              className="mb-1 text-xs font-semibold text-muted hover:text-accent-soft"
            >
              {allOn ? "☑" : "☐"} {cat.categoryLabel}
            </button>
            <div className="flex flex-wrap gap-1.5">
              {cat.domains.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => toggle(d.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    selected.has(d.id)
                      ? "border-accent bg-accent text-white"
                      : "border-panel-border text-muted hover:border-accent-soft/60"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DomainChips({ domainIds }: { domainIds: string[] }) {
  if (domainIds.length === 0) {
    return <p className="mt-1.5 text-xs text-warn">담당 영역이 없어요 — 영역을 지정해야 해당 영역의 IR 메일을 받아요.</p>;
  }
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {domainIds.map((id) => (
        <span key={id} className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] text-accent-soft">
          {domainLabelById.get(id) ?? id}
        </span>
      ))}
    </div>
  );
}

export function ReviewerSection() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [domainIds, setDomainIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDomains, setEditDomains] = useState<string[]>([]);

  function load() {
    setLoading(true);
    fetch("/api/onboarding/reviewers")
      .then((r) => r.json())
      .then((d) => setReviewers(d.reviewers ?? []))
      .catch(() => setReviewers([]))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function call(method: "POST" | "PATCH" | "DELETE", body?: unknown, query = "") {
    const res = await fetch(`/api/onboarding/reviewers${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "요청에 실패했습니다.");
    return data;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await call("POST", { name, email, domainIds });
      setName("");
      setEmail("");
      setDomainIds([]);
      setShowPicker(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveDomains(id: string) {
    setError(null);
    try {
      await call("PATCH", { id, domainIds: editDomains });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    }
  }

  async function handleRemove(r: Reviewer) {
    if (!window.confirm(`${r.name}님을 삭제할까요? 이 분께 저장해 둔 영역별 상세 기준도 함께 지워져요.`)) return;
    setError(null);
    try {
      await call("DELETE", undefined, `?id=${encodeURIComponent(r.id)}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    }
  }

  return (
    <SectionShell
      title="투자팀 (심사역)"
      count={reviewers.length}
      description="담당 영역의 IR 메일(AI 평가 결과 포함)과 데모데이·LP/출자 참여 등 투자 관련 메일이 등록된 심사역에게 발송돼요."
    >
      {loading && <p className="text-sm text-muted">불러오는 중...</p>}
      {!loading && reviewers.length === 0 && (
        <p className="rounded-lg border border-dashed border-panel-border p-4 text-center text-sm text-muted">
          등록된 심사역이 없어요. 아래에서 추가해 주세요.
        </p>
      )}
      {reviewers.map((r) => (
        <div key={r.id} className="rounded-lg border border-panel-border bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{r.name}</p>
              <p className="text-xs text-muted">{r.email || "이메일 없음 — 메일을 받으려면 이메일이 필요해요"}</p>
            </div>
            <div className="flex shrink-0 gap-3 text-xs">
              <button
                onClick={() => {
                  setEditingId(editingId === r.id ? null : r.id);
                  setEditDomains(r.domainIds);
                }}
                className="text-muted hover:text-accent-soft"
              >
                {editingId === r.id ? "닫기" : "영역 수정"}
              </button>
              <button onClick={() => handleRemove(r)} className="text-muted hover:text-bad">
                삭제
              </button>
            </div>
          </div>
          {editingId === r.id ? (
            <div className="mt-3 space-y-2">
              <DomainChecklist value={editDomains} onChange={setEditDomains} />
              <button
                onClick={() => saveDomains(r.id)}
                className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-soft"
              >
                저장 ({editDomains.length}개 영역)
              </button>
            </div>
          ) : (
            <DomainChips domainIds={r.domainIds} />
          )}
        </div>
      ))}

      <form onSubmit={handleAdd} className="space-y-2 rounded-lg border border-panel-border bg-background p-3">
        <div className="flex flex-wrap items-end gap-2">
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
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="rounded-md border border-panel-border px-3 py-2 text-sm text-muted hover:border-accent-soft/60"
          >
            담당 영역 {domainIds.length > 0 ? `(${domainIds.length})` : "선택"}
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            추가
          </button>
        </div>
        {showPicker && <DomainChecklist value={domainIds} onChange={setDomainIds} />}
      </form>
      {error && <p className="text-xs text-bad">{error}</p>}
    </SectionShell>
  );
}

export function AdminSection() {
  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/onboarding/admin-team")
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
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

  async function handleRemove(m: AdminTeamMember) {
    if (!window.confirm(`${m.name}님을 삭제할까요?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/admin-team?id=${m.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "삭제에 실패했습니다.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    }
  }

  return (
    <SectionShell
      title="관리팀"
      count={members.length}
      description="정부지원사업·협업제안·사무공간 제휴 등 관리 메일, 그리고 담당 심사역이 없는 영역의 IR 메일이 등록된 관리팀 전원에게 발송돼요."
    >
      {loading && <p className="text-sm text-muted">불러오는 중...</p>}
      {!loading && members.length === 0 && (
        <p className="rounded-lg border border-dashed border-panel-border p-4 text-center text-sm text-muted">
          등록된 관리팀 구성원이 없어요. 아래에서 추가해 주세요.
        </p>
      )}
      {members.map((m) => (
        <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-panel-border bg-background p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{m.name}</p>
            <p className="text-xs text-muted">{m.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] text-accent-soft">관리 메일 전체</span>
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
    </SectionShell>
  );
}
