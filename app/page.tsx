"use client";

import { useEffect, useState } from "react";
import { DomainPicker } from "@/components/DomainPicker";
import { PersonaPicker } from "@/components/PersonaPicker";
import { DealInfoForm, type DealInfoValue } from "@/components/DealInfoForm";
import { DisclaimerGate } from "@/components/DisclaimerGate";
import { UploadPanel } from "@/components/UploadPanel";
import { ResultReport } from "@/components/ResultReport";
import { getDomain } from "@/lib/domains";
import type { Persona } from "@/lib/personas/schema";
import type { EvaluationReport } from "@/lib/reportSchema";

type Step = 1 | 2 | 3 | 4 | 5;

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [dealInfo, setDealInfo] = useState<DealInfoValue>({});
  const [agreed, setAgreed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);

  useEffect(() => {
    fetch("/api/personas")
      .then((res) => res.json())
      .then((data) => setPersonas(data.personas as Persona[]))
      .catch(() => setPersonas([]));
  }, []);

  const domain = domainId ? getDomain(domainId) : undefined;
  const persona = personaId ? personas.find((p) => p.id === personaId) : undefined;

  async function handleSubmit() {
    if (!file || !domainId || !personaId) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("domainId", domainId);
      formData.append("personaId", personaId);
      if (dealInfo.stage) formData.append("stage", dealInfo.stage);
      if (dealInfo.preValuationEok) formData.append("preValuationEok", String(dealInfo.preValuationEok));
      if (dealInfo.askAmountEok) formData.append("askAmountEok", String(dealInfo.askAmountEok));

      const res = await fetch("/api/evaluate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "평가에 실패했습니다.");
      }
      setReport(data.report as EvaluationReport);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setStep(1);
    setDomainId(null);
    setPersonaId(null);
    setDealInfo({});
    setAgreed(false);
    setFile(null);
    setError(null);
    setReport(null);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-accent-soft">AI 심사역 IR 평가</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          실제 VC 심사역이 만든 <strong className="text-foreground">심사역 Persona AI</strong>가 IR을 평가합니다.
          <br />
          피치덱·사업계획서를 올리면 한국 벤처투자 실무 기준으로 자료의 충실도를 짚어드려요.
          <br />
          투자 자문이 아니라, 자료를 다듬는 참고용이에요.
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <a href="/internal-login" className="text-muted underline hover:text-accent-soft">
            안다아시아벤처스 직원이신가요? 로그인
          </a>
        </div>
      </header>

      {step < 5 && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
          {["영역 선택", "심사역 선택", "추가 정보", "면책 동의 · 업로드"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  step >= i + 1 ? "bg-accent text-white" : "bg-white/10 text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className={step >= i + 1 ? "text-foreground" : ""}>{label}</span>
              {i < 3 && <span className="mx-1 text-panel-border">—</span>}
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-accent-soft">01</span>영역 선택
          </h2>
          <p className="text-sm text-muted">평가 기준이 영역별로 달라지므로, IR이 다루는 기술영역을 골라주세요.</p>
          <DomainPicker value={domainId} onChange={setDomainId} />
          <button
            disabled={!domainId}
            onClick={() => setStep(2)}
            className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </section>
      )}

      {step === 2 && domainId && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-accent-soft">02</span>심사역 선택
          </h2>
          <p className="text-sm text-muted">
            실제 VC 심사역이 만든 심사역 Persona AI 중에서 골라요. 선택한 영역을 검토하는 심사역만 표시되고, 기본 AI
            심사역은 모든 영역을 봅니다.
          </p>
          <PersonaPicker domainId={domainId} personas={personas} value={personaId} onChange={setPersonaId} />
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="rounded-lg border border-panel-border px-4 py-3 text-sm text-muted">
              뒤로
            </button>
            <button
              disabled={!personaId}
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg bg-accent px-4 py-3 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-accent-soft">03</span>추가 정보{" "}
            <span className="text-xs font-normal text-muted">(선택)</span>
          </h2>
          <p className="text-sm text-muted">
            단계 보정과 밸류 근거 평가에 사용돼요. 입력하지 않으면 자료 맥락으로 추정합니다.
          </p>
          <DealInfoForm value={dealInfo} onChange={setDealInfo} />
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="rounded-lg border border-panel-border px-4 py-3 text-sm text-muted">
              뒤로
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex-1 rounded-lg bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent-soft"
            >
              다음
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-accent-soft">04</span>면책 동의 · IR 업로드
          </h2>
          <DisclaimerGate checked={agreed} onChange={setAgreed} />
          {agreed && (
            <>
              <UploadPanel file={file} onFileChange={setFile} onSubmit={handleSubmit} loading={loading} error={error} />
              <button onClick={() => setStep(3)} className="w-full rounded-lg border border-panel-border py-3 text-sm text-muted">
                뒤로
              </button>
            </>
          )}
        </section>
      )}

      {step === 5 && report && domain && persona && (
        <section>
          <h2 className="mb-6 text-lg font-semibold">
            <span className="mr-2 text-accent-soft">05</span>평가 결과 — {domain.label} · {persona.name}
          </h2>
          <ResultReport
            report={report}
            reviewerName={persona.name}
            reviewerAffiliation={persona.affiliation}
            onReset={resetAll}
          />
        </section>
      )}
    </main>
  );
}
