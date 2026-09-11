"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Persona, SevenPrinciples } from "@/lib/personas/schema";

const EMPTY_SEVEN: SevenPrinciples = {
  intro: "",
  stagePreference: "",
  priorityOrder: ["팀", "시장", "제품·기술", "트랙션", "재무·딜"],
  judgmentPoints: { team: "", market: "", product: "", traction: "", finance: "" },
  preferredTraction: "",
  redFlags: "",
  tone: "",
};

export function PersonaBaseForm({ initial }: { initial?: Persona }) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [id, setId] = useState(initial?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [affiliation, setAffiliation] = useState(initial?.affiliation ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [portfolio, setPortfolio] = useState<string[]>(initial?.portfolio ?? ["", "", "", ""]);
  const [seven, setSeven] = useState<SevenPrinciples>(initial?.sevenPrinciples ?? EMPTY_SEVEN);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePortfolio(idx: number, value: string) {
    setPortfolio((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          affiliation,
          bio,
          portfolio: portfolio.filter((p) => p.trim().length > 0),
          isDefault: false,
          sevenPrinciples: seven,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      router.push(`/onboarding/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
  const labelClass = "mb-1 block text-sm font-medium text-muted";

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border border-panel-border bg-panel p-5">
        <h3 className="font-semibold">A. 기본정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={labelClass}>ID (영문 소문자, 예: gildong)</span>
            <input
              className={inputClass}
              value={id}
              disabled={isEdit}
              onChange={(e) => setId(e.target.value.toLowerCase())}
              placeholder="gildong"
            />
          </label>
          <label className="block">
            <span className={labelClass}>이름</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
          </label>
          <label className="block">
            <span className={labelClass}>소속</span>
            <input
              className={inputClass}
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="안다아시아벤처스"
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>자기소개 (300자 이내)</span>
          <textarea
            className={inputClass}
            rows={3}
            maxLength={300}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <div>
          <span className={labelClass}>대표 포트폴리오 (최대 4개)</span>
          <div className="grid grid-cols-2 gap-3">
            {portfolio.map((p, i) => (
              <input
                key={i}
                className={inputClass}
                value={p}
                onChange={(e) => updatePortfolio(i, e.target.value)}
                placeholder={`회사명 ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-panel-border bg-panel p-5">
        <h3 className="font-semibold">B. 공통 7항목</h3>
        <p className="text-xs text-muted">당신이라는 심사역을 한 문단씩 설명해 주세요. 평가 시 심사역의 관점을 재현하는 데 쓰입니다.</p>

        <label className="block">
          <span className={labelClass}>① 소개 — 당신이 어떤 심사역인지 1~2문장</span>
          <textarea
            className={inputClass}
            rows={2}
            value={seven.intro}
            onChange={(e) => setSeven({ ...seven, intro: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>② 투자단계·섹터 선호</span>
          <input
            className={inputClass}
            value={seven.stagePreference}
            onChange={(e) => setSeven({ ...seven, stagePreference: e.target.value })}
            placeholder="예: 시드~시리즈A, 딥테크 소부장"
          />
        </label>
        <label className="block">
          <span className={labelClass}>③ 평가기준 우선순위 (중요도 순, 쉼표로 구분)</span>
          <input
            className={inputClass}
            value={seven.priorityOrder.join(", ")}
            onChange={(e) => setSeven({ ...seven, priorityOrder: e.target.value.split(",").map((s) => s.trim()) })}
          />
        </label>

        <div>
          <span className={labelClass}>④ 기준별 판단포인트 — 각 기준에서 무엇을 보는지</span>
          <div className="space-y-2">
            {(["team", "market", "product", "traction", "finance"] as const).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-muted">
                  {{ team: "팀", market: "시장", product: "제품·기술", traction: "트랙션", finance: "재무·딜" }[key]}
                </span>
                <input
                  className={inputClass}
                  value={seven.judgmentPoints[key]}
                  onChange={(e) =>
                    setSeven({ ...seven, judgmentPoints: { ...seven.judgmentPoints, [key]: e.target.value } })
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <label className="block">
          <span className={labelClass}>⑤ 선호 트랙션 지표</span>
          <input
            className={inputClass}
            value={seven.preferredTraction}
            onChange={(e) => setSeven({ ...seven, preferredTraction: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>⑥ 레드플래그 — 자료에서 이게 보이면 우려</span>
          <input
            className={inputClass}
            value={seven.redFlags}
            onChange={(e) => setSeven({ ...seven, redFlags: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>⑦ 평가 톤</span>
          <input className={inputClass} value={seven.tone} onChange={(e) => setSeven({ ...seven, tone: e.target.value })} />
        </label>
      </section>

      {error && <p className="rounded-md border border-bad/40 bg-bad/10 px-4 py-2 text-sm text-bad">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={saving || !id || !name || !affiliation}
        className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "저장 중..." : isEdit ? "저장하고 대시보드로" : "등록하고 영역 작성 시작하기"}
      </button>
    </div>
  );
}
