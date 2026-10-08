"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteVisitCard } from "@/components/SiteVisitCard";
import { LinkifiedText } from "@/components/LinkifiedText";

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
  evaluation: { totalScore: number; investmentAttractivenessScore: number | null; investmentVerdict?: string | null; evaluatedModel?: string | null } | null;
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
  const [rankYear, setRankYear] = useState<string>("2026");
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
  const yearOf = (d: DealLite) => (d.date ? String(new Date(d.date).getFullYear()) : "");
  const years = Array.from(new Set(deals.map(yearOf).filter(Boolean))).sort().reverse();
  // 같은 회사가 여러 번 들어온 경우(재제출·재평가)는 가장 높은 점수 한 건만 — 순위에 같은 회사가 반복되지 않게
  const scoreOf = (d: DealLite) => d.evaluation?.investmentAttractivenessScore ?? null;
  const companyKey = (d: DealLite) =>
    d.title.split("|")[0].toLowerCase().replace(/㈜|\(주\)|주식회사/g, "").replace(/[\s()\-_.,·]/g, "");
  const bestByCompany = new Map<string, DealLite>();
  // 순위는 선택한 연도의 딜만 (기본 2026년 · 날짜 없는 딜은 '전체'에서만 보임)
  for (const d of deals.filter((x) => rankYear === "all" || yearOf(x) === rankYear)) {
    const k = companyKey(d) || d.key;
    const cur = bestByCompany.get(k);
    if (!cur || (scoreOf(d) ?? -1) > (scoreOf(cur) ?? -1)) bestByCompany.set(k, d);
  }
  const unique = Array.from(bestByCompany.values());
  const ranked = unique.filter((d) => scoreOf(d) != null).sort((a, b) => scoreOf(b)! - scoreOf(a)!);
  const notEvaluated = unique.filter((d) => scoreOf(d) == null);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl space-y-5 px-4 pb-16 pt-8">
        {loading && <p className="text-sm text-muted">불러오는 중...</p>}
        {error && <p className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</p>}

        {data && (
          <>
            {/* 요약 타일 */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="이번 주 신규 IR" value={data.summary.newIRThisWeek} tone="good" href="/ir-deals" />
              <StatTile label="이번 주 투자팀 전달" value={data.summary.investmentThisWeek} href="/ir-deals" />
              <StatTile label="이번 주 관리팀 전달" value={data.summary.adminThisWeek} href="/mailbox/sent" />
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
                        <Link href={`/ir-deals?open=${encodeURIComponent(d.key)}`} className="flex items-center justify-between gap-3 py-3 hover:text-accent-soft">
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
                title="투자 매력도 순위"
                hint={`${rankYear === "all" ? "전체" : `${rankYear}년`} · 점수 높은 순 · 평가 ${ranked.length}건`}
                action={
                  <Link href="/ir-deals?sort=investment" className="text-xs text-accent-soft hover:underline">
                    전체 보기 →
                  </Link>
                }
              >
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {["all", ...years].map((y) => (
                    <button
                      key={y}
                      onClick={() => setRankYear(y)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${rankYear === y ? "bg-accent text-white" : "bg-black/5 text-muted hover:bg-black/10"}`}
                    >
                      {y === "all" ? "전체" : `${y}년`}
                    </button>
                  ))}
                </div>
                {ranked.length + notEvaluated.length === 0 ? (
                  <p className="py-4 text-sm text-muted">아직 들어온 딜이 없어요.</p>
                ) : (
                  <ol className="max-h-[30rem] divide-y divide-panel-border overflow-y-auto pr-1">
                    {ranked.map((d, i) => {
                      const score = scoreOf(d)!;
                      const legacy = !d.evaluation?.investmentVerdict; // 새 기준 결론 라벨이 없으면 예전 기준 평가
                      return (
                        <li key={d.key}>
                          <Link href={`/ir-deals?open=${encodeURIComponent(d.key)}`} className="flex items-center gap-3 py-3 hover:text-accent-soft">
                            <span className="w-6 shrink-0 text-xs font-semibold text-muted">{i + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{d.title}</span>
                              <span className="block truncate text-xs text-muted">{d.domainLabel}</span>
                            </span>
                            {legacy && <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">이전 기준</span>}
                            <span className={`w-10 shrink-0 text-right text-2xl font-bold leading-none ${scoreTone(score).text}`}>{score}</span>
                          </Link>
                        </li>
                      );
                    })}
                    {notEvaluated.map((d) => (
                      <li key={d.key}>
                        <Link href={`/ir-deals?open=${encodeURIComponent(d.key)}`} className="flex items-center gap-3 py-3 hover:text-accent-soft">
                          <span className="w-6 shrink-0 text-xs text-muted">–</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground/80">{d.title}</span>
                            <span className="block truncate text-xs text-muted">{d.domainLabel}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-warn/15 px-2.5 py-1 text-xs font-medium text-warn">평가 전</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </SectionCard>
            </div>

            {/* 홈페이지 방문 현황 (구글 애널리틱스) */}
            <SiteVisitCard />

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

                <LinkifiedText
                  className="text-sm text-foreground/90"
                  text={fullMailByMsgNum[selectedMsgNum].text || "(본문 텍스트가 없습니다 — 첨부파일 또는 서식만 있는 메일일 수 있어요)"}
                />
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
