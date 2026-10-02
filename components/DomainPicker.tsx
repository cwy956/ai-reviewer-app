"use client";

import { useState } from "react";
import { domainCategories, getDomain } from "@/lib/domains";

export function DomainPicker({
  value,
  subValue,
  onChange,
}: {
  value: string | null;
  subValue: string | null;
  onChange: (domainId: string, subDomainId: string | null) => void;
}) {
  const [activeCategory, setActiveCategory] = useState(domainCategories[0].categoryId);
  const [query, setQuery] = useState("");

  const q = query.trim();
  // 영역명뿐 아니라 세부 영역명으로도 검색 ("전고체" → 이차전지)
  const filteredCategories = q
    ? domainCategories
        .map((c) => ({
          ...c,
          domains: c.domains.filter((d) => d.label.includes(q) || d.subDomains.some((s) => s.label.includes(q))),
        }))
        .filter((c) => c.domains.length > 0)
    : domainCategories;

  const current = filteredCategories.find((c) => c.categoryId === activeCategory) ?? filteredCategories[0];
  const selectedDomain = value ? getDomain(value) : undefined;

  return (
    <div>
      <input
        type="text"
        placeholder="영역 검색 (예: 반도체, 전고체, 생성형AI, 뷰티)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-panel-border bg-panel px-4 py-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
      />

      <div className="mt-4 grid grid-cols-[minmax(0,160px)_1fr] gap-3">
        <div className="flex flex-col gap-1 rounded-lg border border-panel-border bg-panel p-2">
          {filteredCategories.map((c) => (
            <button
              key={c.categoryId}
              onClick={() => setActiveCategory(c.categoryId)}
              className={`rounded-md px-3 py-2 text-left text-sm transition ${
                current?.categoryId === c.categoryId
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-black/5 hover:text-foreground"
              }`}
            >
              {c.categoryLabel}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-panel-border bg-panel p-3">
          {current ? (
            current.domains.map((d) => (
              <button
                key={d.id}
                onClick={() => onChange(d.id, null)}
                className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                  value === d.id
                    ? "border-accent bg-accent/10 text-accent-soft"
                    : "border-panel-border text-foreground hover:border-accent-soft/60"
                }`}
              >
                {d.label}
              </button>
            ))
          ) : (
            <p className="col-span-2 text-sm text-muted">검색 결과가 없습니다.</p>
          )}
        </div>
      </div>

      {selectedDomain && selectedDomain.subDomains.length > 0 && (
        <div className="mt-4 rounded-lg border border-panel-border bg-panel p-4">
          <p className="mb-2 text-xs font-semibold text-muted">
            {selectedDomain.label} 세부 영역 <span className="font-normal">(선택 — 가장 가까운 것 하나)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedDomain.subDomains.map((s) => (
              <button
                key={s.id}
                onClick={() => onChange(selectedDomain.id, subValue === s.id ? null : s.id)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  subValue === s.id
                    ? "border-accent bg-accent text-white"
                    : "border-panel-border text-foreground hover:border-accent-soft/60"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
