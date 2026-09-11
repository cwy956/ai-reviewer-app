"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, type Domain } from "@/lib/domains";
import type { PersonaDomainCriteria } from "@/lib/personas/schema";

const MAX_STARS = 5;
const MAX_FREEFORM = 500;

export function CheckpointForm({
  personaId,
  domain,
  initial,
}: {
  personaId: string;
  domain: Domain;
  initial?: PersonaDomainCriteria;
}) {
  const router = useRouter();
  const [starred, setStarred] = useState<Set<string>>(new Set(initial?.starredCheckpointIds ?? []));
  const [freeform, setFreeform] = useState(initial?.freeform ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_STARS) {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId,
          domainId: domain.id,
          starredCheckpointIds: Array.from(starred),
          freeform,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      router.push(`/onboarding/${personaId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const categories = (["team", "market", "product", "traction", "finance"] as const).map((category) => ({
    category,
    items: domain.checkpoints.filter((c) => c.category === category),
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-panel-border bg-panel p-5">
        <p className="text-sm text-muted">
          아래 25개 체크포인트 중, <strong className="text-foreground">특히 중요하게 보는 {MAX_STARS}개</strong>를 골라
          별표(⭐)로 표시하세요. 현재{" "}
          <span className={starred.size === MAX_STARS ? "text-good" : "text-accent-soft"}>
            {starred.size} / {MAX_STARS}
          </span>{" "}
          선택됨.
        </p>
      </div>

      {categories.map(({ category, items }) => (
        <div key={category} className="rounded-lg border border-panel-border bg-panel p-5">
          <h4 className="mb-3 font-semibold">{CATEGORY_LABELS[category]}</h4>
          <div className="space-y-2">
            {items.map((cp) => {
              const isStarred = starred.has(cp.id);
              const disabled = !isStarred && starred.size >= MAX_STARS;
              return (
                <button
                  key={cp.id}
                  onClick={() => toggle(cp.id)}
                  disabled={disabled}
                  className={`flex w-full items-start gap-2 rounded-md border p-2.5 text-left text-sm transition ${
                    isStarred
                      ? "border-warn/50 bg-warn/10"
                      : disabled
                        ? "border-panel-border opacity-40"
                        : "border-panel-border hover:border-accent-soft/60"
                  }`}
                >
                  <span className={isStarred ? "text-warn" : "text-muted"}>{isStarred ? "⭐" : "☆"}</span>
                  <span>{cp.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-panel-border bg-panel p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">
            자유 서술 — 체크포인트로 못 담는 이 영역만의 판단 기준
          </span>
          <span className="text-xs text-muted">
            {freeform.length} / {MAX_FREEFORM}
          </span>
        </div>
        <textarea
          className="w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          rows={4}
          maxLength={MAX_FREEFORM}
          value={freeform}
          onChange={(e) => setFreeform(e.target.value)}
          placeholder="예: 퀄은 몇 단계인지보다 어느 고객사 라인인지를 본다"
        />
      </div>

      {error && <p className="rounded-md border border-bad/40 bg-bad/10 px-4 py-2 text-sm text-bad">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "저장 중..." : "저장하고 대시보드로"}
      </button>
    </div>
  );
}
