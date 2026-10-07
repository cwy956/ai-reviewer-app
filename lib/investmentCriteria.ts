// 안다아시아벤처스 실제 투심보고서 19건·회의 녹취 7건 분석으로 확정한 투자 매력도 기준.
// 프롬프트·도구 스키마·가중평균·화면이 모두 이 파일 하나를 보도록 해서 기준이 어긋나지 않게 함.

export type InvestmentCriterionId =
  | "techAdvantage"
  | "tractionCertainty"
  | "concentrationRisk";

export interface InvestmentCheckDef {
  id: string;
  label: string;
}

export interface InvestmentCriterionDef {
  id: InvestmentCriterionId;
  label: string;
  /** 화면 칩·막대용 짧은 이름. */
  shortLabel: string;
  /** 가중치(합 100). TOP2(기술·트랙션)가 45씩. */
  weight: number;
  /** 점수의 방향 — 프롬프트에 그대로 들어감. */
  scoreMeaning: string;
  /** TOP2는 세부 질문을 하나씩 파고들어 verdict를 매김. */
  checks: InvestmentCheckDef[];
}

export const TECH_CHECKS: InvestmentCheckDef[] = [
  { id: "D1-1", label: "차별성 주장이 정량 수치(성능·수율·속도·정확도)와 경쟁사 대비 비교표로 제시되는가" },
  { id: "D1-2", label: "제3자 검증이 있는가 (공인 시험·인증, 대기업 공동개발·퀄 테스트·샘플 평가, 전략적 투자)" },
  { id: "D1-3", label: "방어력: 특허가 건수가 아니라 핵심 기술을 덮는가(등록 여부·해외), 데이터·노하우·락인이 있는가" },
  { id: "D1-4", label: "\"왜 경쟁사는 못 하는가\"에 구체적으로 답하는가 (일반론이 아닌 진입장벽 설명)" },
  { id: "D1-5", label: "기술 성숙도와 양산·상용화 근거가 있는가 (TRL, 양산 경험, 제작 파트너의 실제 경험·설비)" },
  { id: "D1-6", label: "외부 의존(핵심 부품·파트너·외부 모델·라이선스)이 차별성을 훼손하지 않는가" },
  { id: "D1-7", label: "핵심 기술 인력의 수준이 기술 주장을 뒷받침하는가" },
  { id: "D1-8", label: "\"세계 최초·유일·독점\" 같은 표현에 근거가 있는가" },
];

export const TRACTION_CHECKS: InvestmentCheckDef[] = [
  { id: "D2-1", label: "성과를 확정(계약·수주·유료·매출 인식) / 진행(파일럿·샘플 평가) / 의향(LOI·MOU·구매의향서) 단계로 구분해 쓰고 있는가" },
  { id: "D2-2", label: "숫자의 출처: 실제 매출인지 회사 가이던스·추정인지, 계약 금액·시점·기간이 있는가" },
  { id: "D2-3", label: "레퍼런스 고객의 실명과 실제 거래 규모가 있는가" },
  { id: "D2-4", label: "파일럿→양산(상용화) 전환 이력: PoC가 실제 계약으로 이어졌는가" },
  { id: "D2-5", label: "매출의 질: 일회성 과제·실증 vs 반복 수주(재구매율), 구축형 변동성" },
  { id: "D2-6", label: "돈이 실제로 들어오는가: 선수금·대금 흐름, 미청구 매출·채권 회수" },
  { id: "D2-7", label: "공공·정부 사업 선정 여부가 확정인지 (해당 없으면 '해당 없음')" },
  { id: "D2-8", label: "수주 파이프라인이 단계별 금액으로 구분되어 있는가" },
];

export const INVESTMENT_CRITERIA: InvestmentCriterionDef[] = [
  {
    id: "techAdvantage",
    label: "기술·경쟁우위의 검증 가능성",
    shortLabel: "기술·경쟁우위",
    weight: 45,
    scoreMeaning: "높을수록 기술·차별성 주장이 외부 근거로 검증되고 방어 가능하다는 뜻",
    checks: TECH_CHECKS,
  },
  {
    id: "tractionCertainty",
    label: "트랙션의 확정도",
    shortLabel: "트랙션 확정도",
    weight: 45,
    scoreMeaning: "높을수록 성과가 확정 매출·계약으로 뒷받침되고 질이 좋다는 뜻 (의향서·MOU 위주면 낮음)",
    checks: TRACTION_CHECKS,
  },
  {
    id: "concentrationRisk",
    label: "편중·의존 리스크",
    shortLabel: "편중 리스크",
    weight: 10,
    scoreMeaning: "높을수록 고객·국가·파트너가 분산되어 있다(리스크 낮음), 낮을수록 특정 상대에 쏠려 있다",
    checks: [],
  },
];

export const CRITERION_BY_ID: Record<string, InvestmentCriterionDef> = Object.fromEntries(
  INVESTMENT_CRITERIA.map((c) => [c.id, c])
);

export const CHECK_LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  INVESTMENT_CRITERIA.flatMap((c) => c.checks.map((k) => [k.id, k.label]))
);

/**
 * 프롬프트로 "90점에서 시작"이라고 해도 모델이 같은 IR에 64~72점대로 수렴해서(실제 투자한 딜이 80점 안팎이어야 한다는
 * 기대와 어긋남), 코드에서 모델 점수에 일정 가산을 더함. 기준별 점수에 적용한 뒤 가중평균을 내므로 화면의 기준별
 * 점수와 종합이 일관됨. 값을 바꾸려면 여기만 고치면 되고, 이미 저장된 평가는 영향 없음.
 */
export const SCORE_CALIBRATION_OFFSET = 10;

export function calibrateScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw) + SCORE_CALIBRATION_OFFSET));
}

/**
 * 최종(보정 후) 점수로 결론 라벨을 정하고, 모델이 준 재료(이유·확인 항목)를 그 라벨에 맞는 한 줄로 조립.
 * 모델이 결론 문구까지 쓰면 점수와 어조가 어긋나서(82점인데 "확인되면 검토 가능") 코드가 조립함.
 */
export function composeVerdict(
  score: number,
  reason: string,
  confirmItem: string
): { verdict: "적극 검토" | "조건부 검토" | "보류"; verdictLine: string } {
  const r = reason.trim();
  const c = confirmItem.trim();
  if (score >= 80) return { verdict: "적극 검토", verdictLine: `적극 투자 검토 필요 — ${r}` };
  if (score >= 65) {
    return { verdict: "조건부 검토", verdictLine: c ? `${c} 확인되면 투자 검토 가능 — ${r}` : `확인 사항 해소 시 투자 검토 가능 — ${r}` };
  }
  return { verdict: "보류", verdictLine: `현 시점 투자 검토 보류 — ${r}` };
}

export const CHECK_VERDICTS = ["확인됨", "부분", "근거 없음", "해당 없음"] as const;
export type CheckVerdict = (typeof CHECK_VERDICTS)[number];

/** 판단 불가(determinable=false)인 기준은 빼고 나머지 가중치로 재정규화 — 정보가 없다고 감점하지 않음. */
export function computeWeightedScore(
  criteria: { criterion: string; score: number; determinable: boolean }[]
): number | null {
  let weightSum = 0;
  let total = 0;
  for (const c of criteria) {
    const def = CRITERION_BY_ID[c.criterion];
    if (!def || !c.determinable) continue;
    weightSum += def.weight;
    total += def.weight * c.score;
  }
  return weightSum > 0 ? Math.round(total / weightSum) : null;
}
