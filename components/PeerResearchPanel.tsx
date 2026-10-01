"use client";

import { useState } from "react";
import type { PeerResearchResult } from "@/lib/reportSchema";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function PeerResearchPanel({
  evaluationId,
  dealTitle,
  domainLabel,
  initial,
}: {
  evaluationId: number;
  dealTitle: string;
  domainLabel: string;
  initial?: PeerResearchResult;
}) {
  const [result, setResult] = useState<PeerResearchResult | undefined>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runResearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ir-deals/peer-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluationId, dealTitle, domainLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "리서치에 실패했습니다.");
      setResult(data.peerResearch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Peer 현황조사</h3>
        <button
          onClick={runResearch}
          disabled={loading}
          className="rounded-md border border-accent-soft/60 px-3 py-1 text-xs font-medium text-accent-soft transition hover:bg-accent-tint disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "웹 검색 중... (최대 2분)" : result ? "다시 리서치" : "리서치 실행"}
        </button>
      </div>
      <p className="mb-4 text-xs text-muted">
        웹 검색으로 같은 영역의 비교 가능한 기업을 찾아 드려요 (공개 정보 기반 참고용 — 투자 판단의 근거로만 쓰기엔
        부족할 수 있어요).
      </p>

      {error && <p className="mb-3 text-sm text-bad">{error}</p>}

      {!result && !loading && !error && (
        <p className="text-sm text-muted">아직 리서치를 실행하지 않았어요. 버튼을 눌러 비교 기업을 찾아보세요.</p>
      )}

      {result && (
        <>
          <p className="mb-3 text-xs text-muted">{formatDateTime(result.researchedAt)} 기준</p>
          <p className="mb-4 text-sm leading-relaxed text-foreground">{result.summary}</p>
          <ul className="space-y-3">
            {result.peers.map((p, i) => (
              <li key={i} className="rounded-md border border-panel-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs text-accent-soft hover:underline"
                    >
                      출처 ↗
                    </a>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{p.description}</p>
                <p className="mt-1.5 text-sm text-foreground/90">{p.comparisonNote}</p>
              </li>
            ))}
            {result.peers.length === 0 && <li className="text-sm text-muted">비교할 만한 기업을 찾지 못했어요.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
