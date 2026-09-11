"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS, CATEGORY_ORDER, type ClassifiedMail, type MailCategory } from "@/lib/mail/classify";

interface FullMail {
  msgNum: number;
  from: string;
  subject: string;
  date: string;
  text: string;
  attachments: { filename: string; size: number }[];
}

const PRIORITY_RANK: Record<string, number> = { 높음: 0, 중간: 1, 낮음: 2 };

const CATEGORY_BADGE: Record<MailCategory, string> = {
  ir: "bg-accent/20 text-accent-soft",
  gov_program: "bg-white/10 text-muted",
  biz_proposal: "bg-white/10 text-muted",
  spam: "bg-bad/10 text-bad",
  etc: "bg-white/10 text-muted",
};

const PRIORITY_BADGE: Record<string, string> = {
  높음: "bg-bad/20 text-bad",
  중간: "bg-warn/20 text-warn",
  낮음: "bg-white/10 text-muted",
};

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function MailboxPage() {
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mails, setMails] = useState<ClassifiedMail[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [processedAt, setProcessedAt] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<MailCategory | "all">("all");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [watchState, setWatchState] = useState<{ lastAlertedCount: number; lastCheckedAt: string; lastAlertedAt: string | null } | null>(null);
  const [watchChecking, setWatchChecking] = useState(false);
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const [expandedMsgNum, setExpandedMsgNum] = useState<number | null>(null);
  const [fullMailByMsgNum, setFullMailByMsgNum] = useState<Record<number, FullMail>>({});
  const [fullMailLoading, setFullMailLoading] = useState<number | null>(null);
  const [fullMailError, setFullMailError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mail/watch")
      .then((res) => res.json())
      .then((data) => setWatchState(data.state))
      .catch(() => {});
  }, []);

  async function checkNewMailNow() {
    setWatchChecking(true);
    setWatchMsg(null);
    try {
      const res = await fetch("/api/mail/watch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "확인에 실패했습니다.");
      setWatchMsg(
        data.alerted
          ? `새 메일 ${data.newSinceLastAlert}통 감지 — Teams 알림을 보냈습니다.`
          : `새 메일 ${data.newSinceLastAlert}통 (아직 알림 기준 미달, 전체 ${data.totalInMailbox}통).`
      );
      const statusRes = await fetch("/api/mail/watch");
      setWatchState((await statusRes.json()).state);
    } catch (err) {
      setWatchMsg(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setWatchChecking(false);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    setProcessedAt(null);
    try {
      const res = await fetch(`/api/mail/classify?limit=${limit}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "불러오기에 실패했습니다.");
      setMails(data.mails as ClassifiedMail[]);
      setTotal(data.total as number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loadBacklog() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/backlog");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "전체 백로그를 불러오지 못했습니다.");
      setMails(data.mails as ClassifiedMail[]);
      setTotal(data.totalInMailbox as number);
      setProcessedAt(data.processedAt as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function submitBacklogJob() {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/mail/backlog/submit", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "백로그 작업 제출에 실패했습니다.");
      setSubmitMsg(
        `제출됨: 메일 ${data.submittedCount}통 (${data.chunkCount}개 배치) · batch ID ${data.batchId}. ` +
          `터미널에서 "npx tsx scripts/finalize-backlog.mts"를 실행해 완료를 기다려주세요.`
      );
    } catch (err) {
      setSubmitMsg(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendTeamsDigest() {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/mail/notify-teams", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Teams 전송에 실패했습니다.");
      const describe = (label: string, r: { ok: boolean; skipped?: boolean; error?: string }) =>
        r.ok ? `${label} 전송됨` : r.skipped ? `${label} 웹훅 미설정` : `${label} 실패(${r.error ?? "알 수 없음"})`;
      setSubmitMsg(`${describe("심사역용", data.reviewer)} · ${describe("관리팀용", data.admin)}`);
    } catch (err) {
      setSubmitMsg(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function checkBacklogStatus() {
    setCheckingStatus(true);
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/mail/backlog/submit");
      const data = await res.json();
      if (!data.pending) {
        setSubmitMsg("진행 중인 백로그 작업이 없습니다.");
      } else {
        setSubmitMsg(
          `상태: ${data.status ?? "확인 불가"} · 제출된 메일 ${data.pending.mails.length}통 ` +
            `(제출 시각 ${formatDate(data.pending.submittedAt)})`
        );
      }
    } catch (err) {
      setSubmitMsg(err instanceof Error ? err.message : "상태 확인 중 오류가 발생했습니다.");
    } finally {
      setCheckingStatus(false);
    }
  }

  async function toggleExpand(msgNum: number) {
    if (expandedMsgNum === msgNum) {
      setExpandedMsgNum(null);
      return;
    }
    setExpandedMsgNum(msgNum);
    setFullMailError(null);
    if (fullMailByMsgNum[msgNum]) return; // already fetched
    setFullMailLoading(msgNum);
    try {
      const res = await fetch(`/api/mail/message/${msgNum}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "전체 내용을 불러오지 못했습니다.");
      setFullMailByMsgNum((prev) => ({ ...prev, [msgNum]: data as FullMail }));
    } catch (err) {
      setFullMailError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setFullMailLoading(null);
    }
  }

  const counts: Record<string, number> = { all: mails.length };
  for (const cat of CATEGORY_ORDER) counts[cat] = mails.filter((m) => m.category === cat).length;

  const filtered = (activeCategory === "all" ? mails : mails.filter((m) => m.category === activeCategory))
    .slice()
    .sort((a, b) => {
      const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-accent-soft">메일함 자동 분류</h1>
        <p className="mt-2 text-sm text-muted">
          공용 메일함(POP3)에서 최근 메일을 가져와 IR·투자관련 / 정부지원사업 / 협업제안 / 스팸 / 기타로 자동 분류합니다.
        </p>
        <a href="/" className="mt-3 inline-block text-xs text-muted underline hover:text-accent-soft">
          ← IR 평가 앱으로
        </a>
      </header>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-panel-border bg-panel p-4">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">최근 몇 통을 불러올까요? (최대 300)</span>
          <input
            type="number"
            min={1}
            max={300}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-28 rounded-md border border-panel-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "불러오는 중..." : "최근 N통 불러오기 (실시간)"}
        </button>
        <button
          onClick={loadBacklog}
          disabled={loading}
          className="rounded-lg border border-panel-border px-4 py-2 text-sm text-muted transition enabled:hover:border-accent-soft/60 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          전체 백로그 보기 (미리 처리된 결과)
        </button>
        {total !== null && !processedAt && (
          <span className="text-xs text-muted">
            메일함 전체 {total.toLocaleString()}통 중 최근 {mails.length}통을 분류했어요.
          </span>
        )}
        {total !== null && processedAt && (
          <span className="text-xs text-muted">
            전체 {total.toLocaleString()}통 중 {mails.length}통 처리됨 · {formatDate(processedAt)} 기준
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-panel-border bg-panel p-4">
        <div className="flex-1 text-xs text-muted">
          메일함 전체를 한 번에 분류하려면(수백~수천 통), 실시간 방식 대신 배치 작업으로 처리하세요. 비용이 저렴하고 안정적입니다.
        </div>
        <button
          onClick={submitBacklogJob}
          disabled={submitting}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "제출 중..." : "전체 백로그 처리 시작"}
        </button>
        <button
          onClick={checkBacklogStatus}
          disabled={checkingStatus}
          className="rounded-lg border border-panel-border px-4 py-2 text-sm text-muted transition enabled:hover:border-accent-soft/60 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {checkingStatus ? "확인 중..." : "진행 상태 확인"}
        </button>
        <button
          onClick={sendTeamsDigest}
          disabled={submitting}
          className="rounded-lg border border-panel-border px-4 py-2 text-sm text-muted transition enabled:hover:border-accent-soft/60 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Teams로 지금 요약 보내기
        </button>
      </div>
      {submitMsg && (
        <p className="mb-6 rounded-md border border-panel-border bg-panel px-4 py-3 text-xs text-muted">{submitMsg}</p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-panel-border bg-panel p-4">
        <div className="flex-1 text-xs text-muted">
          앞으로 들어오는 신규 메일은 서버가 5분마다 자동으로 확인해서, 처리 안 된 메일이 5통 이상 쌓이면 Teams로 알려줍니다.
          {watchState && (
            <span className="ml-1 text-muted/70">
              (마지막 확인: {formatDate(watchState.lastCheckedAt)}
              {watchState.lastAlertedAt ? ` · 마지막 알림: ${formatDate(watchState.lastAlertedAt)}` : " · 아직 알림 없음"})
            </span>
          )}
        </div>
        <button
          onClick={checkNewMailNow}
          disabled={watchChecking}
          className="rounded-lg border border-panel-border px-4 py-2 text-sm text-muted transition enabled:hover:border-accent-soft/60 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {watchChecking ? "확인 중..." : "지금 신규 메일 확인"}
        </button>
      </div>
      {watchMsg && (
        <p className="mb-6 rounded-md border border-panel-border bg-panel px-4 py-3 text-xs text-muted">{watchMsg}</p>
      )}

      {error && (
        <p className="mb-6 rounded-md border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p>
      )}

      {loading && (
        <div className="rounded-lg border border-panel-border bg-panel p-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-panel-border border-t-accent" />
          <p className="text-sm text-muted">메일을 가져와 분류하는 중이에요. 통수가 많으면 시간이 좀 걸려요.</p>
        </div>
      )}

      {!loading && mails.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={`rounded-full px-3 py-1 text-xs transition ${
                activeCategory === "all" ? "bg-accent text-white" : "bg-white/5 text-muted hover:bg-white/10"
              }`}
            >
              전체 ({counts.all})
            </button>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  activeCategory === cat ? "bg-accent text-white" : "bg-white/5 text-muted hover:bg-white/10"
                }`}
              >
                {CATEGORY_LABELS[cat]} ({counts[cat] ?? 0})
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map((mail) => {
              const isExpanded = expandedMsgNum === mail.msgNum;
              const full = fullMailByMsgNum[mail.msgNum];
              return (
                <div key={mail.msgNum} className="rounded-lg border border-panel-border bg-panel p-4">
                  <button onClick={() => toggleExpand(mail.msgNum)} className="w-full text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[mail.category]}`}>
                        {CATEGORY_LABELS[mail.category]}
                      </span>
                      {mail.category === "ir" && (
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${PRIORITY_BADGE[mail.priority]}`}>
                          우선순위 {mail.priority}
                        </span>
                      )}
                      {mail.hasAttachment && (
                        <span className="rounded border border-panel-border px-2 py-0.5 text-[11px] text-muted">첨부 가능성</span>
                      )}
                      <span className="ml-auto text-[11px] text-muted">{formatDate(mail.date)}</span>
                    </div>
                    <p className="mt-2 font-medium">{mail.subject}</p>
                    <p className="text-xs text-muted">{mail.from}</p>
                    {!isExpanded && mail.snippet && (
                      <p className="mt-1 text-xs text-muted line-clamp-2">{mail.snippet}</p>
                    )}
                    <p className="mt-1 text-[11px] italic text-muted">{mail.reason}</p>
                    <p className="mt-2 text-[11px] text-accent-soft">{isExpanded ? "▲ 접기" : "▼ 전체 내용 보기"}</p>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 border-t border-panel-border pt-3">
                      {fullMailLoading === mail.msgNum && <p className="text-xs text-muted">불러오는 중...</p>}
                      {fullMailError && fullMailLoading !== mail.msgNum && !full && (
                        <p className="text-xs text-bad">{fullMailError}</p>
                      )}
                      {full && (
                        <>
                          {full.attachments.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                              {full.attachments.map((a, i) => (
                                <span
                                  key={i}
                                  className="rounded border border-panel-border px-2 py-0.5 text-[11px] text-muted"
                                >
                                  📎 {a.filename} ({(a.size / 1024).toFixed(0)}KB)
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-xs text-foreground/90">
                            {full.text || "(본문 텍스트가 없습니다 — 첨부파일 또는 서식만 있는 메일일 수 있어요)"}
                          </p>
                          <p className="mt-2 text-[11px] text-muted">
                            첨부파일 원본이나 완전한 서식이 필요하면 후이즈메일 웹메일에서 직접 확인해 주세요.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && mails.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-panel-border p-8 text-center text-sm text-muted">
          아직 불러온 메일이 없어요. 위에서 "불러오기"를 눌러주세요.
        </p>
      )}
    </main>
  );
}
