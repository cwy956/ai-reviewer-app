"use client";

import { useState } from "react";
import { domainCategories, getDomain } from "@/lib/domains";

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel">
      <p className="border-b border-panel-border px-3 py-2 text-xs font-semibold text-muted">{title}</p>
      <div className="flex flex-col gap-1 p-2">{children}</div>
    </div>
  );
}

function Item({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-left text-sm transition ${
        selected ? "bg-accent text-white" : "text-foreground hover:bg-black/5"
      }`}
    >
      {children}
    </button>
  );
}

// 대분류(12대 국가전략기술 + 기타) → 중분류(평가 영역) → 소분류(세부 영역, 선택)를 가로로 이어서 고름.
export function DomainPicker({
  value,
  subValue,
  onChange,
}: {
  value: string | null;
  subValue: string | null;
  onChange: (domainId: string | null, subDomainId: string | null) => void;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(
    (value ? getDomain(value)?.categoryId : undefined) ?? domainCategories[0].categoryId
  );

  const category = domainCategories.find((c) => c.categoryId === activeCategoryId) ?? domainCategories[0];
  const selectedDomain = category.domains.find((d) => d.id === value);

  function pickCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    const next = domainCategories.find((c) => c.categoryId === categoryId);
    // 중분류가 하나뿐인 대분류는 바로 그걸 선택
    onChange(next && next.domains.length === 1 ? next.domains[0].id : null, null);
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Column title="대분류">
        {domainCategories.map((c) => (
          <Item key={c.categoryId} selected={c.categoryId === category.categoryId} onClick={() => pickCategory(c.categoryId)}>
            {c.categoryLabel}
          </Item>
        ))}
      </Column>

      <Column title="중분류">
        {category.domains.map((d) => (
          <Item key={d.id} selected={d.id === value} onClick={() => onChange(d.id, null)}>
            {d.label}
          </Item>
        ))}
      </Column>

      <Column title="소분류 (선택)">
        {!selectedDomain && <p className="px-3 py-2 text-sm text-muted">중분류를 선택하세요.</p>}
        {selectedDomain && selectedDomain.subDomains.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted">세부 영역이 없어요.</p>
        )}
        {selectedDomain?.subDomains.map((s) => (
          <Item key={s.id} selected={s.id === subValue} onClick={() => onChange(selectedDomain.id, subValue === s.id ? null : s.id)}>
            {s.label}
          </Item>
        ))}
      </Column>
    </div>
  );
}
