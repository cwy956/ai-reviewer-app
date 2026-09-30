"use client";

import { useEffect, useState } from "react";
import { domains } from "@/lib/domains";
import type { Persona } from "@/lib/personas/schema";
import type { EvaluationReport } from "@/lib/reportSchema";
import { ResultReport } from "@/components/ResultReport";

interface DealEvaluation {
  msgNum: number;
  domainId: string;
  personaId: string;
  personaName: string;
  attachmentFilename: string;
  totalScore: number;
  investmentAttractivenessScore: number | null;
  evaluatedAt: string;
}

interface Deal {
  msgNum: number;
  subject: string;
  from: string;
  date: string | null;
  hasAttachment: boolean;
  domainId: string | null;
  domainLabel: string;
  priority: string;
  evaluation: DealEvaluation | null;
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

export default function IrDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Deal | null>(null);
  const [fullMail, setFullMail] = useState<FullMail | null>(null);
  const [mailLoading, setMailLoading] = useState(false);
  const [latestReport, setLatestReport] = useState<EvaluationReport | null>(null);
  const [showEvalForm, setShowEvalForm] = useState(false);

  const [formDomainId, setFormDomainId] = useState("");
  const [formPersonaId, setFormPersonaId] = useState("");
  const [formAttachmentIndex, setFormAttachmentIndex] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  function loadDeals() {
    setLoading(true);
    fetch("/api/mail/ir-list")
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
    fetch("/api/personas")
      .then((res) => res.json())
      .then((data) => setPersonas((data.personas ?? []).filter((p: Persona) => !p.isDefault)))
      .catch(() => setPersonas([]));
  }, []);

  async function openDeal(deal: Deal) {
    setSelected(deal);
    setFullMail(null);
    setLatestReport(null);
    setShowEvalForm(!deal.evaluation);
    setEvalError(null);
    setFormDomainId(deal.domainId ?? "");
    setFormAttachmentIndex(0);

    setMailLoading(true);
    try {
      const res = await fetch(`/api/mail/message/${deal.msgNum}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "메일을 불러오지 못했습니다.");
      setFullMail(data as FullMail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setMailLoading(false);
    }

    if (deal.evaluation) {
      try {
        const res = await fetch(`/api/mail/evaluate/${deal.msgNum}`);
        const data = await res.json();
        const latest = data.evaluations?.[0];
        if (latest) {
          setLatestReport(latest.report);
          setFormPersonaId(latest.personaId);
          setFormDomainId(latest.domainId);
        }
      } catch {
        // non-fatal — the badge on the list already summarizes the score
      }
    }
  }

  async function runEvaluation() {
    if (!selected || !formDomainId || !formPersonaId || !fullMail?.attachments.length) return;
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
          personaId: formPersonaId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "평가에 실패했습니다.");
      setLatestReport(data.evaluation.report);
      setShowEvalForm(false);
      loadDeals();
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setEvaluating(false);
    }
  }

  const selectedPersona = personas.find((p) => p.id === formPersonaId);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-accent-soft">IR 딜 목록</h1>
          <p className="mt-2 text-sm text-muted">
            지금까지 들어온 IR 메일을 한 곳에서 열람하고, AI 심사역 평가(투자 매력도 포함)를 바로 돌려볼 수 있어요.
          </p>
          <div className="mt-3 flex gap-4 text-xs">
            <a href="/dashboard" className="text-muted underline hover:text-accent-soft">
              현황 대시보드
            </a>
            <a href="/mailbox" className="text-muted underline hover:text-accent-soft">
              메일함 자동 분류
            </a>
          </div>
        </header>

        {loading && <p className="text-sm text-muted">불러오는 중...</p>}
        {error && <p className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</p>}

        {!loading && deals.length === 0 && (
          <p className="rounded-lg border border-dashed border-panel-border p-6 text-center text-sm text-muted">
            아직 분류된 IR 메일이 없어요.
          </p>
        )}

        <div className="space-y-2">
          {deals.map((deal) => (
            <button
              key={deal.msgNum}
              onClick={() => openDeal(deal)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-panel-border bg-panel p-4 text-left transition hover:border-accent-soft/60"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{deal.subject}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {deal.from} · {deal.domainLabel} · {formatDate(deal.date)}
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
                <h3 className="font-semibold text-foreground">{selected.subject}</h3>
                <p className="mt-1 text-xs text-muted">{selected.from}</p>
              </div>
              <button onClick={() => setSelected(null)} className="shrink-0 text-sm text-muted hover:text-foreground">
                닫기
              </button>
            </div>

            {mailLoading && <p className="text-sm text-muted">메일 불러오는 중...</p>}

            {fullMail && !showEvalForm && latestReport && (
              <>
                <button
                  onClick={() => setShowEvalForm(true)}
                  className="mb-4 text-xs text-accent-soft underline hover:text-accent"
                >
                  다시 평가하기 (다른 심사역·영역으로)
                </button>
                <ResultReport
                  report={latestReport}
                  reviewerName={selectedPersona?.name ?? ""}
                  reviewerAffiliation={selectedPersona?.affiliation ?? ""}
                  onReset={() => setSelected(null)}
                  internalMode
                />
              </>
            )}

            {fullMail && showEvalForm && (
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
                    <div>
                      <label className="mb-1 block text-xs text-muted">심사역</label>
                      <select
                        value={formPersonaId}
                        onChange={(e) => setFormPersonaId(e.target.value)}
                        className="w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                      >
                        <option value="">심사역 선택</option>
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {evalError && <p className="text-sm text-bad">{evalError}</p>}

                    <button
                      onClick={runEvaluation}
                      disabled={evaluating || !formDomainId || !formPersonaId}
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
