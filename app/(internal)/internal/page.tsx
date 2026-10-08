"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface FullMail {
  msgNum: number;
  from: string;
  subject: string;
  date: string;
  text: string;
  attachments: { index: number; filename: string; size: number }[];
}

interface DealLite {
  source: "mail" | "platform";
  key: string;
  title: string;
  domainLabel: string;
  date: string | null;
  evaluation: { totalScore: number; investmentAttractivenessScore: number | null } | null;
}

interface DashboardData {
  summary: {
    newIRThisWeek: number;
    investmentThisWeek: number;
    adminThisWeek: number;
    sendFailed7d: number;
    lastCheckedAt: string | null;
  };
  mailHistory: {
    msgNum: number;
    subject: string;
    from: string;
    receivedAt: string;
    team: "investment" | "admin" | null;
    categoryLabel: string;
    deliveries: { name: string; status: "sent" | "failed" }[];
  }[];
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 75) return { text: "text-good", bar: "bg-good" };
  if (score >= 55) return { text: "text-warn", bar: "bg-warn" };
  return { text: "text-bad", bar: "bg-bad" };
}

function Tag({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "warn" | "bad" | "good" }) {
  const toneClass =
    tone === "warn"
      ? "bg-warn/10 text-warn"
      : tone === "bad"
        ? "bg-bad/10 text-bad"
        : tone === "good"
          ? "bg-good/10 text-good"
          : "bg-accent-tint text-accent-soft";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>{children}</span>;
}

function StatTile({ label, value, tone, href }: { label: string; value: string | number; tone?: "good" | "bad"; href: string }) {
  const toneClass = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-accent";
  return (
    <Link href={href} className="rounded-xl border border-panel-border bg-panel p-4 shadow-sm transition hover:border-accent-soft/50">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1.5 text-3xl font-bold ${toneClass}`}>{value}</p>
    </Link>
  );
}

function SectionCard({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-panel-border bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-semibold">{title}</h2>
          {hint && <span className="text-xs text-muted">{hint}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function InternalHome() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [deals, setDeals] = useState<DealLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [historyTab, setHistoryTab] = useState<"all" | "investment" | "admin">("all");
  const [selectedMsgNum, setSelectedMsgNum] = useState<number | null>(null);
  const [fullMailByMsgNum, setFullMailByMsgNum] = useState<Record<number, FullMail>>({});
  const [fullMailLoading, setFullMailLoading] = useState<number | null>(null);
  const [fullMailError, setFullMailError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/dashboard").then((r) => r.json()), fetch("/api/ir-deals").then((r) => r.json())])
      .then(([dash, irDeals]) => {
        if (dash.error) throw new Error(dash.error);
        setData(dash);
        setDeals(irDeals.deals ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "불러오기에 실패했습니다."))
      .finally(() => setLoading(false));
  }, []);

  async function openMail(msgNum: number) {
    setSelectedMsgNum(msgNum);
    setFullMailError(null);
    if (fullMailByMsgNum[msgNum]) return;
    setFullMailLoading(msgNum);
    try {
      const res = await fetch(`/api/mail/message/${msgNum}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "메일 내용을 불러오지 못했습니다.");
      setFullMailByMsgNum((prev) => ({ ...prev, [msgNum]: json as FullMail }));
    } catch (err) {
      setFullMailError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setFullMailLoading(null);
    }
  }

  const recent = deals.slice(0, 6);
  const topDeals = deals
    .filter((d) => d.evaluation?.investmentAttractivenessScore != null)
    .sort((a, b) => (b.evaluation!.investmentAttractivenessScore ?? 0) - (a.evaluation!.investmentAttractivenessScore ?? 0))
    .slice(0, 5);

  return (
    <main className="flex-1">
      {/* 히어로 — 흰 바탕, 안다 초록 포인트. 서비스 전체(접수·분류·평가)를 한 문장으로 */}
      <section className="border-b border-panel-border bg-gradient-to-b from-white to-accent-tint/60">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-12">
          <p className="text-sm font-medium text-accent-soft">IR 접수부터 투자 검토까지</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            들어오는 IR을 AI가 먼저 읽고,
            <br />
            <span className="text-accent">투자 검토에 필요한 것만 정리합니다</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            메일과 기업 플랫폼으로 접수된 IR을 자동으로 분류해 담당 팀에 전달하고, 투자 매력도 평가와 대표에게 확인할 질문까지
            한 화면에서 확인할 수 있어요.
          </p>
          {data && <p className="mt-4 text-xs text-muted">마지막 메일 확인 · {formatDateTime(data.summary.lastCheckedAt)}</p>}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-5 px-4 pb-16">
        {loading && <p className="-mt-14 text-sm text-muted">불러오는 중...</p>}
        {error && <p className="-mt-14 rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</p>}

        {data && (
          <>
            {/* 요약 타일 — 히어로 위로 겹침 */}
            <div className="-mt-14 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="이번 주 신규 IR" value={data.summary.newIRThisWeek} tone="good" href="/ir-deals" />
              <StatTile label="이번 주 투자팀 수신" value={data.summary.investmentThisWeek} href="/ir-deals" />
              <StatTile label="이번 주 관리팀 수신" value={data.summary.adminThisWeek} href="/mailbox/sent" />
              <StatTile
                label="전달 실패 (7일)"
                value={data.summary.sendFailed7d}
                tone={data.summary.sendFailed7d > 0 ? "bad" : undefined}
                href="/mailbox/sent"
              />
            </div>

            {/* 최근 들어온 IR / 투자 매력도 상위 딜 — 좌우 2단, 점수는 크게 */}
            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard
                title="최근 들어온 IR"
                action={
                  <Link href="/ir-deals" className="text-xs text-accent-soft hover:underline">
                    전체 보기 →
                  </Link>
                }
              >
                {recent.length === 0 ? (
                  <p className="py-4 text-sm text-muted">아직 들어온 IR이 없어요.</p>
                ) : (
                  <ul className="divide-y divide-panel-border">
                    {recent.map((d) => (
                      <li key={d.key}>
                        <Link href="/ir-deals" className="flex items-center justify-between gap-3 py-3 hover:text-accent-soft">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{d.title}</span>
                            <span className="block truncate text-xs text-muted">
                              {d.domainLabel}
                              {d.date ? ` · ${formatMonthDay(d.date)}` : ""}
                            </span>
                          </span>
                          {d.evaluation ? (
                            <span className="shrink-0 text-xs text-muted">평가 완료</span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-warn/15 px-2.5 py-1 text-xs font-medium text-warn">평가 대기</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard
                title="투자 매력도 상위 딜"
                action={
                  <Link href="/ir-deals?sort=investment" className="text-xs text-accent-soft hover:underline">
                    전체 보기 →
                  </Link>
                }
              >
                {topDeals.length === 0 ? (
                  <p className="py-4 text-sm text-muted">아직 평가된 딜이 없어요.</p>
                ) : (
                  <ol className="divide-y divide-panel-border">
                    {topDeals.map((d, i) => {
                      const score = d.evaluation!.investmentAttractivenessScore!;
                      return (
                        <li key={d.key}>
                          <Link href="/ir-deals?sort=investment" className="flex items-center gap-3 py-3 hover:text-accent-soft">
                            <span className="w-4 shrink-0 text-xs font-semibold text-muted">{i + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{d.title}</span>
                              <span className="block truncate text-xs text-muted">{d.domainLabel}</span>
                            </span>
                            <span className={`shrink-0 text-2xl font-bold leading-none ${scoreTone(score).text}`}>{score}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </SectionCard>
            </div>

            {/* 이메일 수신 이력 */}
            <SectionCard title="이메일 수신 이력">
              <div className="mb-3 flex gap-2 text-xs">
                {(
                  [
                    ["all", "전체", data.mailHistory.length],
                    ["investment", "투자", data.mailHistory.filter((m) => m.team === "investment").length],
                    ["admin", "관리", data.mailHistory.filter((m) => m.team === "admin").length],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    onClick={() => setHistoryTab(key)}
                    className={`rounded-full px-3 py-1.5 font-medium transition ${
                      historyTab === key ? "bg-accent text-white" : "bg-black/5 text-muted hover:text-foreground"
                    }`}
                  >
                    {label} {count}
                  </button>
                ))}
              </div>
              <ul className="max-h-[32rem] space-y-1 overflow-y-auto text-sm">
                {data.mailHistory
                  .filter((m) => historyTab === "all" || m.team === historyTab)
                  .map((m) => (
                    <li key={m.msgNum} className="border-b border-panel-border/60 last:border-0">
                      <button
                        onClick={() => openMail(m.msgNum)}
                        className="group flex w-full cursor-pointer items-start justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-accent-tint/40"
                      >
                        <span className="flex min-w-0 items-start gap-2">
                          <span className="mt-0.5 shrink-0">
                            {m.team === "investment" && <Tag>투자</Tag>}
                            {m.team === "admin" && <Tag tone="warn">관리</Tag>}
                            {m.team === null && <Tag tone="bad">스팸</Tag>}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate transition-colors group-hover:text-accent-soft group-hover:underline">
                              {m.subject}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {m.from} · {m.categoryLabel}
                              {m.deliveries.length > 0 && (
                                <>
                                  {" "}
                                  · 전달 {m.deliveries.map((d) => (d.status === "sent" ? d.name : `${d.name}(실패)`)).join(", ")}
                                </>
                              )}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">{formatDateTime(m.receivedAt)}</span>
                      </button>
                    </li>
                  ))}
                {data.mailHistory.length === 0 && <li className="py-2 text-muted">아직 수신 기록이 없어요.</li>}
              </ul>
            </SectionCard>
          </>
        )}
      </div>

      {selectedMsgNum !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedMsgNum(null)}>
          <div
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border border-panel-border bg-panel p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {fullMailLoading === selectedMsgNum && <p className="text-sm text-muted">불러오는 중...</p>}
            {fullMailError && fullMailLoading !== selectedMsgNum && !fullMailByMsgNum[selectedMsgNum] && (
              <p className="text-sm text-bad">{fullMailError}</p>
            )}
            {fullMailByMsgNum[selectedMsgNum] && (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{fullMailByMsgNum[selectedMsgNum].subject}</h3>
                    <p className="mt-1 text-xs text-muted">{fullMailByMsgNum[selectedMsgNum].from}</p>
                    <p className="text-xs text-muted">{formatDateTime(fullMailByMsgNum[selectedMsgNum].date)}</p>
                  </div>
                  <button onClick={() => setSelectedMsgNum(null)} className="shrink-0 text-sm text-muted hover:text-foreground">
                    닫기
                  </button>
                </div>

                {fullMailByMsgNum[selectedMsgNum].attachments.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-xs font-medium text-muted">첨부 자료</p>
                    <ul className="space-y-1.5">
                      {fullMailByMsgNum[selectedMsgNum].attachments.map((a) => (
                        <li key={a.index} className="flex items-center justify-between gap-3 rounded-lg border border-panel-border px-3 py-2 text-sm">
                          <span className="truncate">
                            📎 {a.filename} <span className="text-xs text-muted">({(a.size / 1024).toFixed(0)}KB)</span>
                          </span>
                          <a
                            href={`/api/mail/message/${selectedMsgNum}/attachment/${a.index}`}
                            download={a.filename}
                            className="shrink-0 text-xs font-medium text-accent-soft hover:underline"
                          >
                            다운로드
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {fullMailByMsgNum[selectedMsgNum].text || "(본문 텍스트가 없습니다 — 첨부파일 또는 서식만 있는 메일일 수 있어요)"}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
