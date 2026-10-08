"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Summary {
  newIRThisWeek: number;
  investmentThisWeek: number;
  adminThisWeek: number;
  sendFailed7d: number;
  lastCheckedAt: string | null;
}

interface Deal {
  key: string;
  title: string;
  domainLabel: string;
  date: string | null;
  evaluation: { totalScore: number; investmentAttractivenessScore: number | null } | null;
}

function scoreColor(score: number): string {
  return score >= 75 ? "text-good" : score >= 55 ? "text-warn" : "text-bad";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const SHORTCUTS = [
  { href: "/ir-deals", icon: "📄", title: "IR 딜", desc: "들어온 IR 원문을 보고 AI 평가를 확인해요" },
  { href: "/dashboard", icon: "📊", title: "대시보드", desc: "이번 주 유입과 이메일 수신 이력을 한눈에 봐요" },
  { href: "/mailbox/sent", icon: "✉️", title: "메일 발송 이력", desc: "팀별 알림 메일이 잘 나갔는지 확인해요" },
  { href: "/onboarding", icon: "🧭", title: "심사역 관리", desc: "심사역 평가 관점과 영역별 기준을 설정해요" },
];

export default function InternalHome() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/ir-deals").then((r) => r.json()),
    ])
      .then(([dash, list]) => {
        if (dash.error) throw new Error(dash.error);
        if (list.error) throw new Error(list.error);
        setSummary(dash.summary);
        setDeals(list.deals ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오기에 실패했습니다."));
  }, []);

  const recent = (deals ?? []).slice(0, 6);
  const top = (deals ?? [])
    .filter((d) => d.evaluation?.investmentAttractivenessScore != null)
    .sort((a, b) => (b.evaluation!.investmentAttractivenessScore ?? 0) - (a.evaluation!.investmentAttractivenessScore ?? 0))
    .slice(0, 5);
  const pending = (deals ?? []).filter((d) => !d.evaluation).length;

  const stats = [
    { label: "이번 주 신규 IR", value: summary?.newIRThisWeek, href: "/ir-deals" },
    { label: "투자팀 수신", value: summary?.investmentThisWeek, href: "/dashboard" },
    { label: "관리팀 수신", value: summary?.adminThisWeek, href: "/dashboard" },
    { label: "평가 대기 IR", value: deals ? pending : undefined, href: "/ir-deals" },
  ];

  return (
    <main className="flex-1">
      {/* 히어로 */}
      <section className="bg-gradient-to-br from-accent via-accent to-[#1e3320] text-white">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-14">
          <p className="text-sm text-white/70">안다아시아벤처스는</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
            AI 심사역과 함께
            <br />
            들어오는 IR을 빠르게 검토합니다
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75">
            메일과 플랫폼으로 들어온 IR을 자동으로 분류하고, 투자 매력도와 확인할 질문까지 정리해 드려요.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/ir-deals" className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-white/90">
              IR 딜 보러가기
            </Link>
            <Link href="/dashboard" className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
              대시보드
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* 요약 타일 — 히어로 위로 겹침 */}
        <section className="-mt-14 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-xl border border-panel-border bg-panel p-4 shadow-sm transition hover:border-accent-soft/50"
            >
              <p className="text-xs text-muted">{s.label}</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{s.value ?? "–"}</p>
            </Link>
          ))}
        </section>

        {summary && summary.sendFailed7d > 0 && (
          <Link
            href="/mailbox/sent"
            className="mt-3 block rounded-lg border border-bad/30 bg-bad/5 px-4 py-2.5 text-sm text-bad"
          >
            ⚠ 최근 7일간 메일 발송 실패 {summary.sendFailed7d}건 — 확인하기
          </Link>
        )}
        {error && <p className="mt-3 rounded-lg border border-bad/30 bg-bad/5 px-4 py-2.5 text-sm text-bad">{error}</p>}

        {/* 바로가기 */}
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-foreground">바로가기</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SHORTCUTS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="group rounded-xl border border-panel-border bg-panel p-5 transition hover:-translate-y-0.5 hover:border-accent-soft/50 hover:shadow-sm"
              >
                <span className="text-2xl">{s.icon}</span>
                <p className="mt-3 font-semibold text-foreground group-hover:text-accent-soft">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{s.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* 최근 IR + 투자 매력도 상위 */}
        <section className="mb-16 mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-panel-border bg-panel p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-foreground">최근 들어온 IR</h2>
              <Link href="/ir-deals" className="text-xs text-accent-soft hover:underline">전체 보기 →</Link>
            </div>
            {!deals ? (
              <p className="py-6 text-center text-sm text-muted">불러오는 중...</p>
            ) : recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">아직 들어온 IR이 없어요.</p>
            ) : (
              <ul className="divide-y divide-panel-border">
                {recent.map((d) => (
                  <li key={d.key}>
                    <Link href="/ir-deals" className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent-soft">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{d.title}</span>
                        <span className="text-xs text-muted">{d.domainLabel} · {formatDate(d.date)}</span>
                      </span>
                      <span className="shrink-0 text-xs">
                        {d.evaluation ? (
                          <span className="text-muted">평가 완료</span>
                        ) : (
                          <span className="rounded-full bg-warn/15 px-2 py-0.5 font-medium text-warn">평가 대기</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-panel-border bg-panel p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-foreground">투자 매력도 상위 딜</h2>
              <Link href="/ir-deals?sort=investment" className="text-xs text-accent-soft hover:underline">전체 보기 →</Link>
            </div>
            {!deals ? (
              <p className="py-6 text-center text-sm text-muted">불러오는 중...</p>
            ) : top.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">투자 매력도가 평가된 딜이 아직 없어요.</p>
            ) : (
              <ol className="divide-y divide-panel-border">
                {top.map((d, i) => (
                  <li key={d.key}>
                    <Link href="/ir-deals?sort=investment" className="flex items-center gap-3 py-2.5 text-sm hover:text-accent-soft">
                      <span className="w-4 text-xs font-semibold text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{d.title}</span>
                        <span className="text-xs text-muted">{d.domainLabel}</span>
                      </span>
                      <span className={`text-xl font-bold ${scoreColor(d.evaluation!.investmentAttractivenessScore!)}`}>
                        {d.evaluation!.investmentAttractivenessScore}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
