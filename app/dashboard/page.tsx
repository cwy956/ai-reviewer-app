"use client";

import { useEffect, useState } from "react";
import { DistributionChart } from "@/components/dashboard/DistributionChart";

interface DashboardData {
  summary: {
    totalInMailbox: number | null;
    classifiedCount: number;
    newIRThisWeek: number;
    sendSuccess7d: number;
    sendFailed7d: number;
    lastCheckedAt: string | null;
    lastAlertedAt: string | null;
  };
  gaps: {
    uncoveredDomains: { domainId: string; label: string; irCount: number }[];
    personasWithoutEmail: { id: string; name: string }[];
    recentFailed: { msgNum: number; subject: string; recipientEmail: string; sentAt: string; error: string | null }[];
  };
  categoryDistribution: { category: string; label: string; count: number }[];
  domainDistribution: { domainId: string; label: string; count: number }[];
  reviewerTable: { id: string; name: string; hasEmail: boolean; domainCount: number; receivedCount: number }[];
  feed: (
    | { type: "classified"; at: string; msgNum: number; subject: string; category: string }
    | { type: "sent" | "failed"; at: string; msgNum: number; subject: string; recipientEmail: string }
  )[];
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "불러오기에 실패했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const hasGaps =
    !!data &&
    (data.gaps.uncoveredDomains.length > 0 || data.gaps.personasWithoutEmail.length > 0 || data.gaps.recentFailed.length > 0);

  return (
    <main className="theme-anda-report min-h-screen bg-background text-foreground">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatTile label="전체 메일함" value={data.summary.totalInMailbox ?? "-"} />
                <StatTile label="분류 완료" value={data.summary.classifiedCount} />
                <StatTile label="이번 주 신규 IR" value={data.summary.newIRThisWeek} tone="good" />
                <StatTile label="발송 성공 (7일)" value={data.summary.sendSuccess7d} tone="good" />
                <StatTile
                  label="발송 실패 (7일)"
                  value={data.summary.sendFailed7d}
                  tone={data.summary.sendFailed7d > 0 ? "bad" : undefined}
                />
              </div>

              {/* 놓치고 있는 것 */}
              {hasGaps && (
                <div className="rounded-xl border border-warn/30 bg-panel p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="font-semibold text-foreground">놓치고 있는 것</h2>
                    <Tag tone="warn">확인 필요</Tag>
                  </div>
                  <div className="grid gap-5 md:grid-cols-3">
                    {data.gaps.uncoveredDomains.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted">담당 심사역 없는 업종</p>
                        <ul className="space-y-1.5 text-sm">
                          {data.gaps.uncoveredDomains.map((d) => (
                            <li key={d.domainId} className="flex items-center justify-between gap-2">
                              <span>{d.label}</span>
                              <Tag tone="warn">IR {d.irCount}건</Tag>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.gaps.personasWithoutEmail.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted">이메일 미등록 심사역</p>
                        <ul className="space-y-1.5 text-sm">
                          {data.gaps.personasWithoutEmail.map((p) => (
                            <li key={p.id}>{p.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.gaps.recentFailed.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted">최근 발송 실패</p>
                        <ul className="space-y-1.5 text-sm">
                          {data.gaps.recentFailed.slice(0, 5).map((f, i) => (
                            <li key={i} className="truncate" title={f.error ?? undefined}>
                              {f.subject} → {f.recipientEmail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 분포 차트 */}
              <div className="grid gap-4 md:grid-cols-2">
                <SectionCard title="카테고리별 분포">
                  <DistributionChart data={data.categoryDistribution.map((c) => ({ label: c.label, count: c.count }))} />
                </SectionCard>
                <SectionCard title="업종별 IR 유입량">
                  {data.domainDistribution.length > 0 ? (
                    <DistributionChart data={data.domainDistribution.map((d) => ({ label: d.label, count: d.count }))} />
                  ) : (
                    <p className="text-sm text-muted">아직 업종이 판별된 IR 메일이 없어요.</p>
                  )}
                </SectionCard>
              </div>

              {/* 심사역별 현황 */}
              <SectionCard title="심사역별 현황">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-muted">
                      <tr className="border-b border-panel-border">
                        <th className="pb-2 pr-4 font-medium">이름</th>
                        <th className="pb-2 pr-4 font-medium">이메일 등록</th>
                        <th className="pb-2 pr-4 font-medium">담당 도메인 수</th>
                        <th className="pb-2 font-medium">받은 메일 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reviewerTable.map((r) => (
                        <tr key={r.id} className="border-b border-panel-border/60 last:border-0">
                          <td className="py-2.5 pr-4">{r.name}</td>
                          <td className="py-2.5 pr-4">
                            {r.hasEmail ? <Tag tone="good">등록됨</Tag> : <Tag tone="bad">미등록</Tag>}
                          </td>
                          <td className="py-2.5 pr-4">{r.domainCount}</td>
                          <td className="py-2.5">{r.receivedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* 최근 활동 피드 */}
              <SectionCard title="최근 활동">
                <ul className="max-h-96 space-y-1 overflow-y-auto text-sm">
                  {data.feed.map((item, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 border-b border-panel-border/60 py-2 last:border-0">
                      <span className="flex min-w-0 items-center gap-2">
                        {item.type === "classified" && <Tag>분류</Tag>}
                        {item.type === "sent" && <Tag tone="good">발송</Tag>}
                        {item.type === "failed" && <Tag tone="bad">실패</Tag>}
                        <span className="truncate">
                          {item.subject}
                          {item.type !== "classified" && <span className="text-muted"> → {item.recipientEmail}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{formatDateTime(item.at)}</span>
                    </li>
                  ))}
                  {data.feed.length === 0 && <li className="py-2 text-muted">아직 활동 기록이 없어요.</li>}
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
                <a href="/mailbox" className="text-foreground hover:text-accent-soft">
                  메일함 자동 분류로
                </a>
              </li>
              <li>
                <a href="/internal-evaluate" className="text-foreground hover:text-accent-soft">
                  AI 심사역으로 IR 평가하기
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
    </main>
  );
}
