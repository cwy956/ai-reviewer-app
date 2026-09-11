"use client";

import type { Persona } from "@/lib/personas/schema";

export function PersonaPicker({
  domainId,
  personas,
  value,
  onChange,
}: {
  domainId: string;
  personas: Persona[];
  value: string | null;
  onChange: (personaId: string) => void;
}) {
  const defaultPersona = personas.find((p) => p.isDefault);
  const customPersonas = personas.filter(
    (p) => !p.isDefault && p.domainCriteria.some((c) => c.domainId === domainId)
  );

  if (!defaultPersona) {
    return <p className="text-sm text-muted">심사역 목록을 불러오는 중...</p>;
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => onChange(defaultPersona.id)}
        className={`w-full rounded-lg border p-4 text-left transition ${
          value === defaultPersona.id
            ? "border-accent bg-accent/10"
            : "border-panel-border bg-panel hover:border-accent-soft/60"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted">기본</span>
          <span className="font-semibold">{defaultPersona.name}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{defaultPersona.bio}</p>
      </button>

      {customPersonas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-panel-border p-4 text-sm text-muted">
          이 영역을 검토하는 Persona AI 심사역이 아직 없습니다. 기본 AI 심사역으로 평가해 주세요.
        </p>
      ) : (
        customPersonas.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`w-full rounded-lg border p-4 text-left transition ${
              value === p.id
                ? "border-accent bg-accent/10"
                : "border-panel-border bg-panel hover:border-accent-soft/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent-soft">커스텀</span>
              <span className="font-semibold">{p.name} 심사역</span>
              <span className="text-xs text-muted">{p.affiliation}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{p.bio}</p>
            {p.portfolio.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.portfolio.map((item) => (
                  <span key={item} className="rounded-full border border-panel-border px-2 py-0.5 text-xs text-muted">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  );
}
