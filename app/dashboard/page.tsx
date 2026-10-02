"use client";

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
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
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

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  const toneClass = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-accent";
  return (
    <div className="rounded-xl border border-panel-border bg-panel p-4 shadow-sm">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function SectionCard({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-panel-border bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-semibold">{title}</h2>
        {tag && <Tag>{tag}</Tag>}
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
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

  const topDeals = deals
    .filter((d) => d.evaluation?.investmentAttractivenessScore != null)
    .sort((a, b) => (b.evaluation!.investmentAttractivenessScore ?? 0) - (a.evaluation!.investmentAttractivenessScore ?? 0))
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 lg:flex-row lg:items-start">
        {/* 메인 컨텐츠 */}
        <div className="min-w-0 flex-1 space-y-5">
          <header>
            <Tag>메일함 현황</Tag>
            <h1 className="mt-3 text-2xl font-bold text-foreground">메일함 현황 대시보드</h1>
            <p className="mt-2 text-sm text-muted">메일 분류·발송이 실제로 잘 돌고 있는지, 놓치고 있는 건 없는지 한눈에 봅니다.</p>
            {data && (
              <p className="mt-3 text-xs text-muted">마지막 확인 · {formatDateTime(data.summary.lastCheckedAt)}</p>
            )}
          </header>

          {loading && <p className="text-sm text-muted">불러오는 중...</p>}
          {error && <p className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</p>}

          {data && (
            <>
              {/* 요약 타일 */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
                <StatTile label="이번 주 신규 IR" value={data.summary.newIRThisWeek} tone="good" />
                <StatTile label="이번 주 투자팀 수신" value={data.summary.investmentThisWeek} />
                <StatTile label="이번 주 관리팀 수신" value={data.summary.adminThisWeek} />
                <StatTile
                  label="전달 실패 (7일)"
                  value={data.summary.sendFailed7d}
                  tone={data.summary.sendFailed7d > 0 ? "bad" : undefined}
                />
              </div>

              {/* 투자 매력도 상위 딜 */}
              <SectionCard title="투자 매력도 상위 딜">
                {topDeals.length === 0 ? (
                  <p className="text-sm text-muted">아직 평가된 딜이 없어요.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {topDeals.map((d, i) => (
                      <li key={d.key}>
                        <a
                          href="/ir-deals?sort=investment"
                          className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent-tint/40"
                        >
                          <span className="flex min-w-0 items-start gap-2">
                            <span className="mt-0.5 w-4 shrink-0 text-xs text-muted">{i + 1}</span>
                            <span className="min-w-0">
                              <span className="block truncate">{d.title}</span>
                              <span className="block truncate text-xs text-muted">{d.domainLabel}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted">
                            투자매력도 <span className="font-semibold text-foreground">{d.evaluation!.investmentAttractivenessScore}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

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
                                    · 전달{" "}
                                    {m.deliveries.map((d) => (d.status === "sent" ? d.name : `${d.name}(실패)`)).join(", ")}
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

        {/* 사이드바 */}
        <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-8 lg:w-56">
          <div className="rounded-xl border border-panel-border bg-panel p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold text-muted">바로가기</p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/ir-deals" className="text-foreground hover:text-accent-soft">
                  IR 딜 목록
                </a>
              </li>
              <li>
                <a href="/onboarding" className="text-foreground hover:text-accent-soft">
                  심사역·관리팀 등록
                </a>
              </li>
              <li>
                <a href="/mailbox/sent" className="text-foreground hover:text-accent-soft">
                  이메일 발송 이력
                </a>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {selectedMsgNum !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedMsgNum(null)}
        >
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
