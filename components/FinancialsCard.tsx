import type { FinancialRow, FinancialSummary } from "@/lib/reportSchema";

// IR 자료에 적힌 연도별 매출·영업이익·당기순이익을 묶음 막대그래프로 보여줌. 외부에서 조회한 값이 아니라 IR 기재값이며,
// 올해 이후(또는 IR이 계획·전망으로 표기한) 값은 '추정'으로 연하게·점선 테두리로 그려 확정 실적과 한눈에 구분되게 함.

/** 백만원 단위 숫자를 읽기 쉽게: 1억 이상은 '12.3억', 그 미만은 '35백만'. 적자는 앞에 -. */
function formatWon(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100) return `${sign}${(abs / 100).toFixed(1).replace(/\.0$/, "")}억`;
  return `${sign}${Math.round(abs).toLocaleString()}백만`;
}

type MetricKey = "revenue" | "operatingProfit" | "netIncome";
const SERIES: { label: string; key: MetricKey; color: string }[] = [
  { label: "매출액", key: "revenue", color: "#304b2a" },
  { label: "영업이익", key: "operatingProfit", color: "#6f9a68" },
  { label: "당기순이익", key: "netIncome", color: "#b5ccb0" },
];

const BAR_W = 26;
const BAR_GAP = 4;
const GROUP_PAD = 14;
const GROUP_W = SERIES.length * BAR_W + (SERIES.length - 1) * BAR_GAP + GROUP_PAD * 2;
const PLOT_H = 150; // 양수·음수 막대가 함께 쓰는 세로 길이
const TOP = 18; // 맨 위 막대 값 글자 자리
const BOTTOM = 36; // 아래 값 글자 + 연도 라벨 자리

function Chart({ rows }: { rows: FinancialRow[] }) {
  const values = rows.flatMap((r) => SERIES.map((s) => r[s.key])).filter((v): v is number => v != null);
  const posMax = Math.max(0, ...values);
  const negMax = Math.max(0, ...values.map((v) => -v));
  const total = posMax + negMax || 1;
  const zeroY = TOP + (PLOT_H * posMax) / total;
  const scale = PLOT_H / total;
  const width = rows.length * GROUP_W;
  const height = TOP + PLOT_H + BOTTOM;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ minWidth: width }}
        role="img"
        aria-label="연도별 매출액·영업이익·당기순이익 막대그래프"
      >
        <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="#c9cdc3" strokeWidth={1} />
        {rows.map((r, gi) => {
          const gx = gi * GROUP_W;
          const est = r.kind === "추정";
          return (
            <g key={r.year}>
              {est && <rect x={gx + 2} y={TOP - 14} width={GROUP_W - 4} height={PLOT_H + BOTTOM + 8} rx={6} fill="#a67c2e" opacity={0.06} />}
              {SERIES.map((s, si) => {
                const v = r[s.key];
                if (v == null) return null;
                const x = gx + GROUP_PAD + si * (BAR_W + BAR_GAP);
                const h = Math.max(1.5, Math.abs(v) * scale);
                const y = v >= 0 ? zeroY - h : zeroY;
                const cx = x + BAR_W / 2;
                return (
                  <g key={s.key}>
                    <title>{`${r.year}${est ? " (추정)" : ""} ${s.label} ${formatWon(v)}`}</title>
                    <rect
                      x={x}
                      y={y}
                      width={BAR_W}
                      height={h}
                      rx={2}
                      fill={s.color}
                      fillOpacity={est ? 0.55 : 1}
                      stroke={est ? s.color : "none"}
                      strokeDasharray={est ? "3 2" : undefined}
                    />
                    <text
                      x={cx}
                      y={v >= 0 ? y - 3 : y + h + 10}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight={600}
                      fill={v < 0 ? "#b4534b" : "#1b1f22"}
                      fillOpacity={est ? 0.65 : 1}
                    >
                      {formatWon(v)}
                    </text>
                  </g>
                );
              })}
              <text x={gx + GROUP_W / 2} y={height - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1b1f22">
                {r.year}
                {est ? " 추정" : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function FinancialsCard({ financials }: { financials: FinancialSummary }) {
  const rows = financials.rows;
  const hasEstimate = rows.some((r) => r.kind === "추정");
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">주요 재무지표</h3>
        <span className="text-xs text-muted">IR 자료 기재 수치 · 외부 조회 아님</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">IR 자료에서 재무 수치를 찾지 못했어요.</p>
      ) : (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
            {hasEstimate && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-muted bg-black/10" />
                연한 점선 = 추정
              </span>
            )}
          </div>
          <Chart rows={rows} />
          <p className="mt-1 text-[11px] leading-snug text-muted">
            {hasEstimate && "※ '추정'은 회사가 IR에 제시한 계획·전망치로, 확정된 실적이 아닙니다. "}
            금액은 억원 단위(1억 미만은 백만원). {financials.note}
          </p>
        </>
      )}
    </div>
  );
}
