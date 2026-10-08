import type { FinancialSummary } from "@/lib/reportSchema";

// IR 자료에 적힌 연도별 매출·영업이익·당기순이익. 외부에서 조회한 값이 아니라 IR 기재값이며,
// 올해 이후(또는 IR이 계획·전망으로 표기한) 값은 '추정'으로 눈에 띄게 구분해 확정 실적으로 오해하지 않게 함.

/** 백만원 단위 숫자를 읽기 쉽게: 1억 이상은 '12.3억', 그 미만은 '35백만'. 적자는 앞에 -. */
function formatWon(v: number | null): string {
  if (v == null) return "-";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100) return `${sign}${(abs / 100).toFixed(1).replace(/\.0$/, "")}억`;
  return `${sign}${Math.round(abs).toLocaleString()}백만`;
}

const METRICS: { label: string; key: "revenue" | "operatingProfit" | "netIncome" }[] = [
  { label: "매출액", key: "revenue" },
  { label: "영업이익", key: "operatingProfit" },
  { label: "당기순이익", key: "netIncome" },
];

export function FinancialsCard({ financials }: { financials: FinancialSummary }) {
  const rows = financials.rows;
  const hasEstimate = rows.some((r) => r.kind === "추정");
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">주요 재무지표</h3>
        <span className="text-xs text-muted">IR 자료 기재 수치 · 외부 조회 아님</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">IR 자료에서 재무 수치를 찾지 못했어요.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1 pr-3 text-left font-medium" />
                  {rows.map((r) => (
                    <th key={r.year} className="whitespace-nowrap px-2 py-1 text-right font-medium">
                      {r.year}
                      {r.kind === "추정" && (
                        <span className="ml-1 rounded bg-warn/15 px-1.5 py-0.5 text-[11px] font-semibold text-warn">추정</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => (
                  <tr key={m.key} className="border-t border-panel-border">
                    <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-muted">{m.label}</td>
                    {rows.map((r) => {
                      const v = r[m.key];
                      const tone = r.kind === "추정" ? "italic text-muted" : v != null && v < 0 ? "text-bad" : "";
                      return (
                        <td key={r.year} className={`whitespace-nowrap px-2 py-1.5 text-right font-medium tabular-nums ${tone}`}>
                          {formatWon(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            {hasEstimate && "※ '추정'은 회사가 IR에 제시한 계획·전망치로, 확정된 실적이 아닙니다. "}
            {financials.note}
          </p>
        </>
      )}
    </div>
  );
}
