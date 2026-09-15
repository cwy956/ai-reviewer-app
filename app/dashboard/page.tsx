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

function Card({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  const toneClass = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-accent-soft";
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
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

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-accent-soft">메일함 현황 대시보드</h1>
        <p className="mt-2 text-sm text-muted">메일 분류·발송이 실제로 잘 돌고 있는지, 놓치고 있는 건 없는지 한눈에 봅니다.</p>
        <a href="/mailbox" className="mt-3 inline-block text-xs text-muted underline hover:text-accent-soft">
          ← 메일함 자동 분류로
        </a>
      </header>

      {loading && <p className="text-sm text-muted">불러오는 중...</p>}
      {error && <p className="rounded-md border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p>}

      {data && (
        <div className="space-y-8">
          {/* 요약 카드 */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card label="전체 메일함" value={data.summary.totalInMailbox ?? "-"} />
            <Card label="분류 완료" value={data.summary.classifiedCount} />
            <Card label="이번 주 신규 IR" value={data.summary.newIRThisWeek} tone="good" />
            <Card label="발송 성공 (7일)" value={data.summary.sendSuccess7d} tone="good" />
            <Card label="발송 실패 (7일)" value={data.summary.sendFailed7d} tone={data.summary.sendFailed7d > 0 ? "bad" : undefined} />
            <Card label="마지막 확인" value={formatDateTime(data.summary.lastCheckedAt)} />
          </section>

          {/* 놓치고 있는 것 */}
          {(data.gaps.uncoveredDomains.length > 0 ||
            data.gaps.personasWithoutEmail.length > 0 ||
            data.gaps.recentFailed.length > 0) && (
            <section className="rounded-lg border border-warn/30 bg-warn/5 p-5">
              <h2 className="mb-3 font-semibold text-warn">⚠ 놓치고 있는 것</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {data.gaps.uncoveredDomains.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted">담당 심사역 없는 업종</p>
                    <ul className="space-y-1 text-sm">
                      {data.gaps.uncoveredDomains.map((d) => (
                        <li key={d.domainId}>
                          {d.label} <span className="text-xs text-muted">(IR {d.irCount}건)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.gaps.personasWithoutEmail.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted">이메일 미등록 심사역</p>
                    <ul className="space-y-1 text-sm">
                      {data.gaps.personasWithoutEmail.map((p) => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.gaps.recentFailed.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted">최근 발송 실패</p>
                    <ul className="space-y-1 text-sm">
                      {data.gaps.recentFailed.slice(0, 5).map((f, i) => (
                        <li key={i} className="truncate" title={f.error ?? undefined}>
                          {f.subject} → {f.recipientEmail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 분포 차트 */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-panel-border bg-panel p-5">
              <h2 className="mb-3 font-semibold">카테고리별 분포</h2>
              <DistributionChart data={data.categoryDistribution.map((c) => ({ label: c.label, count: c.count }))} />
            </div>
            <div className="rounded-lg border border-panel-border bg-panel p-5">
              <h2 className="mb-3 font-semibold">업종별 IR 유입량</h2>
              {data.domainDistribution.length > 0 ? (
                <DistributionChart data={data.domainDistribution.map((d) => ({ label: d.label, count: d.count }))} />
              ) : (
                <p className="text-sm text-muted">아직 업종이 판별된 IR 메일이 없어요.</p>
              )}
            </div>
          </section>

          {/* 심사역별 현황 */}
          <section className="rounded-lg border border-panel-border bg-panel p-5">
            <h2 className="mb-3 font-semibold">심사역별 현황</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="pb-2 pr-4">이름</th>
                    <th className="pb-2 pr-4">이메일 등록</th>
                    <th className="pb-2 pr-4">담당 도메인 수</th>
                    <th className="pb-2">받은 메일 수</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reviewerTable.map((r) => (
                    <tr key={r.id} className="border-t border-panel-border">
                      <td className="py-2 pr-4">{r.name}</td>
                      <td className="py-2 pr-4">
                        {r.hasEmail ? (
                          <span className="text-good">등록됨</span>
                        ) : (
                          <span className="text-bad">미등록</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{r.domainCount}</td>
                      <td className="py-2">{r.receivedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 최근 활동 피드 */}
          <section className="rounded-lg border border-panel-border bg-panel p-5">
            <h2 className="mb-3 font-semibold">최근 활동</h2>
            <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
              {data.feed.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-3 border-b border-panel-border/60 pb-2">
                  <span className="truncate">
                    {item.type === "classified" && <span className="text-accent-soft">[분류] </span>}
                    {item.type === "sent" && <span className="text-good">[발송] </span>}
                    {item.type === "failed" && <span className="text-bad">[실패] </span>}
                    {item.subject}
                    {item.type !== "classified" && <span className="text-muted"> → {item.recipientEmail}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatDateTime(item.at)}</span>
                </li>
              ))}
              {data.feed.length === 0 && <li className="text-muted">아직 활동 기록이 없어요.</li>}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
