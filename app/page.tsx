"use client";

import { useState } from "react";
import { DomainPicker } from "@/components/DomainPicker";
import { DealInfoForm, type DealInfoValue } from "@/components/DealInfoForm";
import { DisclaimerGate } from "@/components/DisclaimerGate";
import { UploadPanel } from "@/components/UploadPanel";
import { ResultReport } from "@/components/ResultReport";
import { getDomain } from "@/lib/domains";
import type { EvaluationReport } from "@/lib/reportSchema";

// 심사역 선택 단계는 없앰 — 평가는 항상 기본 AI 심사역(한국 벤처투자 실무 표준 기준) 하나로 수행.
const DEFAULT_PERSONA_ID = "default";

type Step = 1 | 2 | 3 | 4;

// 서버가 JSON이 아닌 오류(플랫폼 타임아웃·용량 초과 등 일반 텍스트)를 줘도 화면에 읽히는 메시지가 나오게 함.
async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: res.ok ? "응답을 해석하지 못했습니다." : res.status === 504 ? "분석 시간이 초과됐어요. 잠시 후 다시 시도해 주세요." : `서버 오류(${res.status})가 발생했습니다.` };
  }
}

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [subDomainId, setSubDomainId] = useState<string | null>(null);
  const [dealInfo, setDealInfo] = useState<DealInfoValue>({});
  const [agreed, setAgreed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);

  const domain = domainId ? getDomain(domainId) : undefined;

  async function handleSubmit() {
    if (!file || !domainId) return;
    setLoading(true);
    setError(null);
    try {
      // 1) 업로드 주소 발급 → 2) 브라우저가 Storage로 직접 업로드(서버 본문 한도 4.5MB 회피) → 3) 경로로 평가 요청
      const urlRes = await fetch("/api/evaluate/upload-url", { method: "POST" });
      const target = await readJson(urlRes);
      if (!urlRes.ok) throw new Error(target.error || "업로드 준비에 실패했습니다.");

      const upload = new FormData();
      upload.append("cacheControl", "3600");
      upload.append("", file);
      const putRes = await fetch(target.signedUrl, { method: "PUT", body: upload });
      if (!putRes.ok) throw new Error("파일 업로드에 실패했습니다. 파일 크기(최대 50MB)와 형식(PDF)을 확인해 주세요.");

      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: target.path,
          filename: file.name,
          domainId,
          subDomainId: subDomainId || undefined,
          personaId: DEFAULT_PERSONA_ID,
          companyName: dealInfo.companyName || undefined,
          stage: dealInfo.stage || undefined,
          preValuationEok: dealInfo.preValuationEok || undefined,
          askAmountEok: dealInfo.askAmountEok || undefined,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(data.error || "평가에 실패했습니다.");
      }
      setReport(data.report as EvaluationReport);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setStep(1);
    setDomainId(null);
    setSubDomainId(null);
    setDealInfo({});
    setAgreed(false);
    setFile(null);
    setError(null);
    setReport(null);
  }

  const showResult = Boolean(report && domain);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-accent-soft">AI 심사역 IR 평가</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed text-foreground">
          IR을 올려주세요. 심사역이 검토하고, 연락드릴 예정입니다.
          <br />
          AI 분석 결과는 바로 확인할 수 있어요. (투자 자문이 아닌 참고용)
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <a href="/internal-login" className="text-muted underline hover:text-accent-soft">
            안다아시아벤처스 직원이신가요? 로그인
          </a>
        </div>
      </header>

      {!showResult && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
          {["영역 선택", "추가 정보", "면책 동의 · 업로드"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  step >= i + 1 ? "bg-accent text-white" : "bg-black/5 text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className={step >= i + 1 ? "text-foreground" : ""}>{label}</span>
              {i < 2 && <span className="mx-1 text-panel-border">—</span>}
            </div>
          ))}
        </div>
      )}

      {!showResult && step === 1 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-accent-soft">01</span>영역 선택
          </h2>
          <p className="text-sm text-muted">평가 기준이 영역별로 달라지므로, IR이 다루는 기술영역을 골라주세요.</p>
          <DomainPicker
            value={domainId}
            subValue={subDomainId}
            onChange={(d, s) => {
              setDomainId(d);
              setSubDomainId(s);
            }}
          />
          <button
            disabled={!domainId}
            onClick={() => setStep(2)}
            className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </section>
      )}

      {!showResult && step === 2 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-accent-soft">02</span>추가 정보{" "}
            <span className="text-xs font-normal text-muted">(선택)</span>
          </h2>
          <p className="text-sm text-muted">
            단계 보정과 밸류 근거 평가에 사용돼요. 입력하지 않으면 자료 맥락으로 추정합니다.
          </p>
          <DealInfoForm value={dealInfo} onChange={setDealInfo} />
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="rounded-lg border border-panel-border px-4 py-3 text-sm text-muted">
              뒤로
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent-soft"
            >
              다음
            </button>
          </div>
        </section>
      )}

      {!showResult && step === 3 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-accent-soft">03</span>면책 동의 · IR 업로드
          </h2>
          <DisclaimerGate checked={agreed} onChange={setAgreed} />
          {agreed && (
            <>
              <UploadPanel file={file} onFileChange={setFile} onSubmit={handleSubmit} loading={loading} error={error} />
              <button onClick={() => setStep(2)} className="w-full rounded-lg border border-panel-border py-3 text-sm text-muted">
                뒤로
              </button>
            </>
          )}
        </section>
      )}

      {showResult && report && domain && (
        <section>
          <h2 className="mb-6 text-lg font-semibold">
            <span className="mr-2 text-accent-soft">04</span>평가 결과 — {domain.label}
          </h2>
          <ResultReport
            report={report}
            reviewerAffiliation="안다아시아벤처스"
            onReset={resetAll}
          />
        </section>
      )}
    </main>
  );
}
