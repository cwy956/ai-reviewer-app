"use client";

import Link from "next/link";
import { domainCategories } from "@/lib/domains";
import type { Persona } from "@/lib/personas/schema";

export function DomainProgressGrid({ persona }: { persona: Persona }) {
  const completedIds = new Set(persona.domainCriteria.map((c) => c.domainId));
  const completedCount = completedIds.size;
  const totalCount = domainCategories.reduce((sum, c) => sum + c.domains.length, 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        작성 완료: <span className="font-semibold text-accent-soft">{completedCount}</span> / {totalCount} 영역
      </p>
      {domainCategories.map((cat) => (
        <div key={cat.categoryId}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{cat.categoryLabel}</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cat.domains.map((d) => {
              const done = completedIds.has(d.id);
              return (
                <Link
                  key={d.id}
                  href={`/onboarding/${persona.id}/${d.id}`}
                  className={`rounded-lg border p-4 transition ${
                    done
                      ? "border-good/40 bg-good/10 hover:border-good/60"
                      : "border-panel-border bg-panel hover:border-accent-soft/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{d.label}</span>
                    <span className={`text-xs ${done ? "text-good" : "text-muted"}`}>{done ? "완료" : "시작 전"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
