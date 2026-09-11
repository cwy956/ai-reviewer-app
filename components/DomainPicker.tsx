"use client";

import { useState } from "react";
import { domainCategories } from "@/lib/domains";

export function DomainPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (domainId: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState(domainCategories[0].categoryId);
  const [query, setQuery] = useState("");

  const filteredCategories = query.trim()
    ? domainCategories
        .map((c) => ({
          ...c,
          domains: c.domains.filter((d) => d.label.includes(query.trim())),
        }))
        .filter((c) => c.domains.length > 0)
    : domainCategories;

  const current = filteredCategories.find((c) => c.categoryId === activeCategory) ?? filteredCategories[0];

  return (
    <div>
      <input
        type="text"
        placeholder="영역 검색 (예: 반도체, 우주항공, AI)"
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
                  : "text-muted hover:bg-white/5 hover:text-foreground"
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
                onClick={() => onChange(d.id)}
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
    </div>
  );
}
