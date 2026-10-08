"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SiteAnalytics } from "@/lib/siteAnalytics";

type State = { status: "loading" } | { status: "off" } | { status: "error"; message: string } | { status: "ok"; data: SiteAnalytics };

const fmt = (n: number) => n.toLocaleString("ko-KR");

/** 홈페이지(andaasiavc.com) 방문 현황 — 접속 중, 기간별 방문자·방문수, 최근 10일 추이, 상위 페이지. */
export function SiteVisitCard() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    fetch("/api/site-analytics")
      .then((r) => r.json())
      .then((j) => {
        if (j.notConfigured) setState({ status: "off" });
        else if (j.error) setState({ status: "error", message: j.error });
        else setState({ status: "ok", data: j.analytics });
      })
      .catch((e) => setState({ status: "error", message: e instanceof Error ? e.message : "불러오기에 실패했습니다." }));
  }, []);

  return (
    <section className="rounded-xl border border-panel-border bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-semibold">홈페이지 방문 현황</h2>
          <span className="text-xs text-muted">andaasiavc.com</span>
        </div>
        {state.status === "ok" && (
          <span className="text-xs text-muted">
            접속 중 <span className="text-lg font-bold text-accent">{state.data.realtimeUsers}</span>명
          </span>
        )}
      </div>

      {state.status === "loading" && <p className="py-6 text-center text-sm text-muted">불러오는 중...</p>}
      {state.status === "off" && (
        <p className="rounded-lg bg-accent-tint/50 px-4 py-6 text-center text-sm text-muted">
          구글 애널리틱스 연동을 준비 중이에요. 연동이 끝나면 방문자 수가 여기에 표시돼요.
        </p>
      )}
      {state.status === "error" && (
        <p className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{state.message}</p>
      )}

      {state.status === "ok" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-panel-border text-xs text-muted">
                  <th className="py-2 text-left font-medium">기간</th>
                  <th className="py-2 text-right font-medium">방문자수</th>
                  <th className="py-2 text-right font-medium">방문수</th>
                </tr>
              </thead>
              <tbody>
                {state.data.periods.map((p) => (
                  <tr key={p.key} className="border-b border-panel-border/60 last:border-0">
                    <td className="py-2 text-muted">{p.label}</td>
                    <td className="py-2 text-right text-base font-semibold text-accent">{fmt(p.visitors)}</td>
                    <td className="py-2 text-right text-base font-semibold text-foreground/80">{fmt(p.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted">구글 애널리틱스 기준 · 합계는 연동을 시작한 날부터 집계돼요 · 5분마다 갱신</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted">최근 10일</p>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={state.data.daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#e7e9e4" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#7c8175" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7c8175" }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="visits" name="방문수" stroke="#304b2a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="visitors" name="방문자수" stroke="#a67c2e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </section>
  );
}
