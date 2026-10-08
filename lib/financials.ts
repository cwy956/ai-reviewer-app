import type { FinancialSummary } from "./reportSchema";

// IR 자료에 적힌 재무 수치(매출액·영업이익·당기순이익)를 연도별로 뽑는 공용 조각.
// 평가 본문(evaluate.ts)과 기존 평가 보강(스크립트)이 같은 스키마·같은 정리 규칙을 쓰도록 분리.
// 외부에서 조회한 값이 아니라 "IR에 적힌 값"만 담음 — 모델이 계산하거나 짐작해서 채우지 않게 스키마 설명에 못박아 둠.

const nullableNumber = { type: ["number", "null"] } as const;

export const FINANCIALS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  description:
    "IR 자료에 '적혀 있는' 연도별 매출액·영업이익·당기순이익만 옮겨 적으세요(외부 지식·계산·추정 금지). 모든 금액은 백만원 단위 숫자로 환산(예: 12억 → 1200, 3,500만원 → 35, 적자는 음수). 본문 문장·표·그래프 어디에 적혀 있든 연도별 실적(확정 결산)과 계획을 모두 rows에 넣고, note에만 적고 rows에서 빠뜨리지 마세요(예: '2025년 매출 30억'은 2025 행으로). 표기 단위가 불분명하면 그 행은 넣지 마세요. 해당 연도에 그 항목이 적혀 있지 않으면 null. 수치가 전혀 없으면 rows는 빈 배열. 최근 4~5개 연도까지만, 오래된 순으로.",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          year: { type: "integer", description: "회계연도(예: 2025)" },
          kind: {
            type: "string",
            enum: ["실적", "추정"],
            description: "IR에서 확정 결산·실적으로 표기된 값이면 '실적', 목표·계획·전망·예상·E·F·잠정·가정 등 미래/추정으로 표기됐거나 어느 쪽인지 불분명하면 '추정'",
          },
          revenue: { ...nullableNumber, description: "매출액(백만원)" },
          operatingProfit: { ...nullableNumber, description: "영업이익(백만원, 적자는 음수)" },
          netIncome: { ...nullableNumber, description: "당기순이익(백만원, 적자는 음수)" },
        },
        required: ["year", "kind", "revenue", "operatingProfit", "netIncome"],
      },
    },
    note: {
      type: "string",
      description: "수치 해석상 알아둘 점 한 줄(예: '2024년은 상반기 누계', '연결 기준'). 없으면 빈 문자열.",
    },
  },
  required: ["rows", "note"],
} as const;

/**
 * 모델 결과 정리. 올해(평가 시점 연도) 이후 수치는 IR이 '실적'이라고 적었더라도 아직 확정될 수 없으므로 '추정'으로 못박음.
 * (예: 2026년에 받은 IR의 2026년 매출 = 회사가 추정한 값.) 모든 값이 비어 있는 행은 버림.
 */
export function normalizeFinancials(raw: FinancialSummary | undefined, now = new Date()): FinancialSummary | undefined {
  if (!raw || !Array.isArray(raw.rows)) return undefined;
  const thisYear = now.getFullYear();
  const rows = raw.rows
    .filter((r) => Number.isInteger(r.year) && (r.revenue != null || r.operatingProfit != null || r.netIncome != null))
    .map((r) => ({ ...r, kind: r.year >= thisYear ? ("추정" as const) : r.kind }))
    .sort((a, b) => a.year - b.year);
  return { rows, note: raw.note ?? "" };
}
