"use client";

import { PublicHeader } from "@/components/PublicHeader";
import { useState } from "react";
import { DomainPicker } from "@/components/DomainPicker";
import { DealInfoForm, isContactComplete, type DealInfoValue } from "@/components/DealInfoForm";
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
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
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
          contactName: dealInfo.contactName || undefined,
          contactEmail: dealInfo.contactEmail || undefined,
          contactPhone: dealInfo.contactPhone || undefined,
          comment: dealInfo.comment || undefined,
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
    setPrivacyAgreed(false);
    setFile(null);
    setError(null);
    setReport(null);
  }

  const showResult = Boolean(report && domain);

  return (
    <>
    <PublicHeader linkHref="/internal" linkLabel="관리자 페이지 이동" />
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-accent-soft">투자 제안 제출</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed text-foreground">
          안다아시아벤처스에 IR 자료를 제출해 주세요. 심사역이 직접 검토합니다.
          <br />
          제출하시면 AI 심사역이 자료를 바로 분석해 피드백을 드려요.
        </p>
        <p className="mt-1 text-xs text-muted">AI 피드백은 투자 자문이 아닌 참고용이에요.</p>
      </header>

      {!showResult && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
          {["제안 영역", "회사·연락처", "동의 · 제출"].map((label, i) => (
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
            <span className="mr-2 text-accent-soft">01</span>제안 영역 선택
          </h2>
          <p className="text-sm text-muted">제안하시는 사업의 기술영역을 골라주세요. AI 심사역이 영역에 맞는 기준으로 피드백을 드려요.</p>
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
            <span className="mr-2 text-accent-soft">02</span>회사·연락처
          </h2>
          <p className="text-sm text-muted">
            검토가 진행되면 이 연락처로 연락드려요. 코멘트에는 회사 소개나 제안 배경을 자유롭게 적어 주세요.
          </p>
          <DealInfoForm value={dealInfo} onChange={setDealInfo} />
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="rounded-lg border border-panel-border px-4 py-3 text-sm text-muted">
              뒤로
            </button>
            <button
              disabled={!isContactComplete(dealInfo)}
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg bg-accent px-4 py-3 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </section>
      )}

      {!showResult && step === 3 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-accent-soft">03</span>동의 · IR 제출
          </h2>
          <DisclaimerGate checked={agreed} onChange={setAgreed} privacyChecked={privacyAgreed} onPrivacyChange={setPrivacyAgreed} />
          {agreed && privacyAgreed && (
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
            <span className="mr-2 text-accent-soft">04</span>제출 완료 — AI 심사역 피드백 ({domain.label})
          </h2>
          <p className="mb-6 -mt-3 text-sm text-muted">투자 제안이 접수됐어요. 아래는 AI 심사역이 제출하신 IR을 분석한 피드백이에요.</p>
          <ResultReport
            report={report}
            reviewerAffiliation="안다아시아벤처스"
            onReset={resetAll}
          />
        </section>
      )}
    </main>
    </>
  );
}
