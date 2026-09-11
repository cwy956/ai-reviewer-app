"use client";

export interface DealInfoValue {
  stage?: string;
  preValuationEok?: number;
  askAmountEok?: number;
}

const STAGES = [
  { value: "Seed", label: "Seed", desc: "초기 단계 — '신호' 중심으로 평가" },
  { value: "Pre-A", label: "Pre-A", desc: "시리즈 A 직전 — 트랙션 데이터 기대" },
  { value: "Series A+", label: "Series A+", desc: "후기 단계 — '증빙' 중심으로 평가" },
];

export function DealInfoForm({
  value,
  onChange,
}: {
  value: DealInfoValue;
  onChange: (v: DealInfoValue) => void;
}) {
  return (
    <div className="space-y-5 rounded-lg border border-panel-border bg-panel p-5">
      <div>
        <p className="mb-2 text-sm font-medium text-muted">투자단계</p>
        <div className="grid grid-cols-3 gap-2">
          {STAGES.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange({ ...value, stage: value.stage === s.value ? undefined : s.value })}
              className={`rounded-md border p-3 text-left transition ${
                value.stage === s.value
                  ? "border-accent bg-accent/10 text-accent-soft"
                  : "border-panel-border hover:border-accent-soft/60"
              }`}
            >
              <div className="text-sm font-semibold">{s.label}</div>
              <div className="mt-1 text-xs text-muted">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">pre-밸류에이션 (억 원)</span>
          <input
            type="number"
            min={0}
            value={value.preValuationEok ?? ""}
            onChange={(e) =>
              onChange({ ...value, preValuationEok: e.target.value ? Number(e.target.value) : undefined })
            }
            className="w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="예: 500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">희망 투자금액 (억 원)</span>
          <input
            type="number"
            min={0}
            value={value.askAmountEok ?? ""}
            onChange={(e) =>
              onChange({ ...value, askAmountEok: e.target.value ? Number(e.target.value) : undefined })
            }
            className="w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="예: 100"
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        모두 선택 입력입니다 — 입력하지 않으면 자료 맥락으로 단계를 추정합니다.
      </p>
    </div>
  );
}
