"use client";

import { useEffect, useState } from "react";
import { domains } from "@/lib/domains";
import type { EvaluationReport } from "@/lib/reportSchema";
import { ResultReport } from "@/components/ResultReport";

// 심사역 선택 자체를 없앰 — AI 심사역 하나로 통일 (개별 심사역이 각자 페르소나를 유지보수하는
// 일이 실제로 일어나지 않아서). 기본 페르소나의 id는 고정값.
const DEFAULT_PERSONA_ID = "default";

interface DealEvaluationSummary {
  totalScore: number;
  investmentAttractivenessScore: number | null;
  evaluatedAt: string;
  personaName: string;
}

interface Deal {
  source: "mail" | "platform";
  key: string;
  msgNum: number | null;
  evaluationId: number | null;
  title: string;
  subtitle: string;
  date: string | null;
  domainId: string | null;
  domainLabel: string;
  evaluation: DealEvaluationSummary | null;
}

interface FullMailAttachment {
  index: number;
  filename: string;
  size: number;
}

interface FullMail {
  msgNum: number;
  from: string;
  subject: string;
  date: string;
  text: string;
  attachments: FullMailAttachment[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 70 ? "text-good" : score >= 40 ? "text-warn" : "text-bad";
  return <span className={`font-semibold ${tone}`}>{score}</span>;
}

function SourceTag({ source }: { source: "mail" | "platform" }) {
  return source === "mail" ? (
    <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-medium text-accent-soft">메일함</span>
  ) : (
    <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn">플랫폼 제출</span>
  );
}

export default function IrDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Deal | null>(null);
  const [fullMail, setFullMail] = useState<FullMail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [latestReport, setLatestReport] = useState<EvaluationReport | null>(null);
  const [reportPersonaName, setReportPersonaName] = useState("AI 심사역");
  const [showEvalForm, setShowEvalForm] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);

  const [formDomainId, setFormDomainId] = useState("");
  const [formAttachmentIndex, setFormAttachmentIndex] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  function loadDeals() {
    setLoading(true);
    fetch("/api/ir-deals")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setDeals(data.deals ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "불러오기에 실패했습니다."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDeals();
  }, []);

  async function openDeal(deal: Deal) {
    setSelected(deal);
    setFullMail(null);
    setLatestReport(null);
    setReportPersonaName("AI 심사역");
    setShowEvalForm(deal.source === "mail" && !deal.evaluation);
    setShowOriginal(true);
    setEvalError(null);
    setFormDomainId(deal.domainId ?? "");
    setFormAttachmentIndex(0);
    setDetailLoading(true);

    try {
      if (deal.source === "platform") {
        const res = await fetch(`/api/ir-deals/platform/${deal.evaluationId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "제출 내역을 불러오지 못했습니다.");
        setLatestReport(data.submission.report);
        setReportPersonaName(data.submission.personaName);
        setFormDomainId(data.submission.domainId);
        return;
      }

      // source === "mail"
      const res = await fetch(`/api/mail/message/${deal.msgNum}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "메일을 불러오지 못했습니다.");
      setFullMail(data as FullMail);

      if (deal.evaluation) {
        const evalRes = await fetch(`/api/mail/evaluate/${deal.msgNum}`);
        const evalData = await evalRes.json();
        const latest = evalData.evaluations?.[0];
        if (latest) {
          setLatestReport(latest.report);
          setReportPersonaName(latest.personaName);
          setFormDomainId(latest.domainId);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function runEvaluation() {
    if (!selected || selected.source !== "mail" || !formDomainId || !fullMail?.attachments.length) return;
    setEvaluating(true);
    setEvalError(null);
    try {
      const res = await fetch("/api/mail/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msgNum: selected.msgNum,
          attachmentIndex: formAttachmentIndex,
          domainId: formDomainId,
          personaId: DEFAULT_PERSONA_ID,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "평가에 실패했습니다.");
      setLatestReport(data.evaluation.report);
      setReportPersonaName(data.evaluation.personaName);
      setShowEvalForm(false);
      loadDeals();
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-accent-soft">IR 딜 목록</h1>
          <p className="mt-2 text-sm text-muted">
            공용 메일함으로 온 IR과 공개 평가 페이지에 스타트업이 직접 올린 IR을 한 곳에서 열람해요. 새 메일은
            매일 자동으로 평가되고, 플랫폼 제출은 그 자리에서 바로 평가돼요.
          </p>
          <div className="mt-3 flex gap-4 text-xs">
            <a href="/dashboard" className="text-muted underline hover:text-accent-soft">
              현황 대시보드
            </a>
            <a href="/mailbox/sent" className="text-muted underline hover:text-accent-soft">
              이메일 발송 이력
            </a>
          </div>
        </header>

        {loading && <p className="text-sm text-muted">불러오는 중...</p>}
        {error && <p className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</p>}

        {!loading && deals.length === 0 && (
          <p className="rounded-lg border border-dashed border-panel-border p-6 text-center text-sm text-muted">
            아직 들어온 IR이 없어요.
          </p>
        )}

        <div className="space-y-2">
          {deals.map((deal) => (
            <button
              key={deal.key}
              onClick={() => openDeal(deal)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-panel-border bg-panel p-4 text-left transition hover:border-accent-soft/60"
            >
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <SourceTag source={deal.source} />
                </div>
                <p className="truncate font-medium">{deal.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {deal.subtitle} · {deal.domainLabel} · {formatDate(deal.date)}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs">
                {deal.evaluation ? (
                  <div>
                    <p className="text-muted">완성도 <ScoreBadge score={deal.evaluation.totalScore} /></p>
                    {deal.evaluation.investmentAttractivenessScore !== null && (
                      <p className="text-muted">
                        투자매력도 <ScoreBadge score={deal.evaluation.investmentAttractivenessScore} />
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="rounded-full bg-accent-tint px-2.5 py-1 font-medium text-accent-soft">평가 필요</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-panel-border bg-panel p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1">
                  <SourceTag source={selected.source} />
                </div>
                <h3 className="font-semibold text-foreground">{selected.title}</h3>
                <p className="mt-1 text-xs text-muted">{selected.subtitle}</p>
              </div>
              <button onClick={() => setSelected(null)} className="shrink-0 text-sm text-muted hover:text-foreground">
                닫기
              </button>
            </div>

            {detailLoading && <p className="text-sm text-muted">불러오는 중...</p>}

            {!detailLoading && selected.source === "mail" && fullMail && (
              <div className="mb-6 rounded-lg border border-panel-border bg-background p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted">원문</p>
                  <button
                    onClick={() => setShowOriginal((v) => !v)}
                    className="text-xs text-accent-soft underline hover:text-accent"
                  >
                    {showOriginal ? "접기" : "펼치기"}
                  </button>
                </div>
                {showOriginal && (
                  <>
                    {fullMail.attachments.length > 0 && (
                      <div className="mb-3 space-y-1.5">
                        {fullMail.attachments.map((a) => (
                          <div
                            key={a.index}
                            className="flex items-center justify-between gap-3 rounded-md border border-panel-border px-3 py-2 text-sm"
                          >
                            <span className="truncate">
                              📎 {a.filename} <span className="text-xs text-muted">({(a.size / 1024).toFixed(0)}KB)</span>
                            </span>
                            <a
                              href={`/api/mail/message/${selected.msgNum}/attachment/${a.index}`}
                              download={a.filename}
                              className="shrink-0 text-xs font-medium text-accent-soft hover:underline"
                            >
                              다운로드
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-foreground/90">
                      {fullMail.text || "(본문 텍스트가 없습니다 — 첨부파일 또는 서식만 있는 메일일 수 있어요)"}
                    </p>
                  </>
                )}
              </div>
            )}

            {!detailLoading && selected.source === "platform" && latestReport && (
              <p className="mb-6 rounded-lg border border-panel-border bg-background p-4 text-xs text-muted">
                원문: {selected.subtitle} (업로드된 원본 파일은 저장되지 않아 다시 열람할 수 없어요 — 평가 결과만
                남아있어요)
              </p>
            )}

            {!detailLoading && latestReport && (
              <>
                {selected.source === "mail" && (
                  <button
                    onClick={() => setShowEvalForm(true)}
                    className="mb-4 text-xs text-accent-soft underline hover:text-accent"
                  >
                    다시 평가하기 (다른 영역으로)
                  </button>
                )}
                <ResultReport
                  report={latestReport}
                  reviewerName={reportPersonaName}
                  reviewerAffiliation="안다아시아벤처스"
                  onReset={() => setSelected(null)}
                  internalMode
                />
              </>
            )}

            {!detailLoading && selected.source === "mail" && showEvalForm && fullMail && (
              <div className="space-y-4">
                {fullMail.attachments.length === 0 ? (
                  <p className="rounded-lg border border-warn/30 bg-warn/5 p-4 text-sm text-warn">
                    이 메일에는 첨부파일이 없어서 평가할 자료가 없어요.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-xs text-muted">평가할 첨부파일</label>
                      <select
                        value={formAttachmentIndex}
                        onChange={(e) => setFormAttachmentIndex(Number(e.target.value))}
                        className="w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                      >
                        {fullMail.attachments.map((a) => (
                          <option key={a.index} value={a.index}>
                            {a.filename} ({(a.size / 1024).toFixed(0)}KB)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">영역</label>
                      <select
                        value={formDomainId}
                        onChange={(e) => setFormDomainId(e.target.value)}
                        className="w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                      >
                        <option value="">영역 선택</option>
                        {domains.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {evalError && <p className="text-sm text-bad">{evalError}</p>}

                    <button
                      onClick={runEvaluation}
                      disabled={evaluating || !formDomainId}
                      className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {evaluating ? "평가 중... (최대 1~2분)" : "AI 평가 시작"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
