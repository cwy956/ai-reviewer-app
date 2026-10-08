"use client";

export interface DealInfoValue {
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** 심사역에게 전하고 싶은 말 */
  comment?: string;
  stage?: string;
  preValuationEok?: number;
  askAmountEok?: number;
}

const STAGES = [
  { value: "Seed", label: "Seed", desc: "초기 단계 — '신호' 중심으로 평가" },
  { value: "Pre-A", label: "Pre-A", desc: "시리즈 A 직전 — 트랙션 데이터 기대" },
  { value: "Series A+", label: "Series A+", desc: "후기 단계 — '증빙' 중심으로 평가" },
];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 필수 항목(회사명·담당자·이메일)이 채워졌는지 */
export function isContactComplete(v: DealInfoValue): boolean {
  return Boolean(v.companyName?.trim() && v.contactName?.trim() && v.contactEmail && EMAIL_RE.test(v.contactEmail.trim()));
}

const fieldClass =
  "w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function DealInfoForm({
  value,
  onChange,
}: {
  value: DealInfoValue;
  onChange: (v: DealInfoValue) => void;
}) {
  return (
    <div className="space-y-5 rounded-lg border border-panel-border bg-panel p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">
            회사명 <span className="text-bad">*</span>
          </span>
          <input
            type="text"
            value={value.companyName ?? ""}
            onChange={(e) => onChange({ ...value, companyName: e.target.value || undefined })}
            className={fieldClass}
            placeholder="예: 안다테크"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">
            담당자 이름 <span className="text-bad">*</span>
          </span>
          <input
            type="text"
            value={value.contactName ?? ""}
            onChange={(e) => onChange({ ...value, contactName: e.target.value || undefined })}
            className={fieldClass}
            placeholder="예: 홍길동"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">
            이메일 <span className="text-bad">*</span>
          </span>
          <input
            type="email"
            value={value.contactEmail ?? ""}
            onChange={(e) => onChange({ ...value, contactEmail: e.target.value || undefined })}
            className={fieldClass}
            placeholder="name@company.com"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">
            연락처 <span className="text-xs font-normal">(선택)</span>
          </span>
          <input
            type="tel"
            value={value.contactPhone ?? ""}
            onChange={(e) => onChange({ ...value, contactPhone: e.target.value || undefined })}
            className={fieldClass}
            placeholder="010-0000-0000"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-muted">
          심사역에게 전하고 싶은 말 <span className="text-xs font-normal">(선택)</span>
        </span>
        <textarea
          value={value.comment ?? ""}
          maxLength={2000}
          rows={4}
          onChange={(e) => onChange({ ...value, comment: e.target.value || undefined })}
          className={fieldClass}
          placeholder="회사 소개, 이번 투자 제안의 배경, 특별히 봐주셨으면 하는 점 등을 자유롭게 적어 주세요."
        />
        <span className="mt-1 block text-right text-xs text-muted">{(value.comment ?? "").length} / 2000</span>
      </label>

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
        투자단계·밸류·투자금액은 선택 입력이에요 — 입력하지 않으면 자료 맥락으로 단계를 추정합니다.
      </p>
    </div>
  );
}
