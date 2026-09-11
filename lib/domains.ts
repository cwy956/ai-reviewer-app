export type CheckpointCategory = "team" | "market" | "product" | "traction" | "finance";

export interface Checkpoint {
  id: string;
  category: CheckpointCategory;
  label: string;
}

export interface Domain {
  id: string;
  label: string;
  categoryId: string;
  categoryLabel: string;
  checkpoints: Checkpoint[];
}

export interface DomainCategory {
  categoryId: string;
  categoryLabel: string;
  domains: { id: string; label: string }[];
}

export const CATEGORY_LABELS: Record<CheckpointCategory, string> = {
  team: "팀",
  market: "시장",
  product: "제품·기술",
  traction: "트랙션",
  finance: "재무·딜",
};

function buildCheckpoints(domainId: string, domainLabel: string): Checkpoint[] {
  const specs: { category: CheckpointCategory; texts: string[] }[] = [
    {
      category: "team",
      texts: [
        `창업자·핵심 인력의 ${domainLabel} 도메인 실무 경력이 소속·기간과 함께 기재됨`,
        `핵심 인력의 관련 산업(대기업·연구소 등) 이력이 역할별로 기재됨`,
        `양산·실증·스케일업 경험 보유자의 존재가 명시됨`,
        `기술 인력과 사업·영업 인력의 구성이 드러남`,
        `핵심 인력 유지 장치(지분·스톡옵션 등)가 언급됨`,
      ],
    },
    {
      category: "market",
      texts: [
        `목표 시장 규모(TAM/SAM/SOM)가 근거·출처와 함께 기재됨`,
        `시장 성장률·수요 근거가 정량화되어 기재됨`,
        `고객 세그먼트가 명확히 기재됨`,
        `경쟁 구도 및 자사 포지셔닝이 기재됨`,
        `진입 타이밍 논리(기술·정책·수요 사이클 등)가 기재됨`,
      ],
    },
    {
      category: "product",
      texts: [
        `${domainLabel} 밸류체인 내 위치와 한 줄 차별성이 정의됨`,
        `경쟁 대비 기술 차별성이 정량 지표(스펙·성능 등)로 기재됨`,
        `특허·IP 현황이 건수·핵심 내용과 함께 기재됨`,
        `기술 성숙도(TRL 등) 단계가 명시됨`,
        `양산성·상용화 전환 계획이 기재됨`,
      ],
    },
    {
      category: "traction",
      texts: [
        `고객사 PO/MOU/계약 실적이 고객·규모와 함께 기재됨`,
        `검증 단계(퀄·인증·실증 등)가 기재됨`,
        `파일럿→양산 전환 실적 또는 계획이 기재됨`,
        `매출·수주잔고가 수치로 기재됨`,
        `정부과제·파트너십 실적이 기재됨`,
      ],
    },
    {
      category: "finance",
      texts: [
        `번레이트·런웨이가 수치로 기재됨`,
        `CAPEX/자금소요 규모와 회수 계획(또는 자산경량 전략)이 기재됨`,
        `pre-밸류/이전 라운드 정보와 밸류 근거가 기재됨`,
        `자금 사용 계획이 항목별로 기재됨`,
        `후속 투자·정부과제 연계가 기재됨`,
      ],
    },
  ];

  return specs.flatMap((spec) =>
    spec.texts.map((text, i) => ({
      id: `${domainId}-${spec.category}-${i + 1}`,
      category: spec.category,
      label: text,
    }))
  );
}

interface DomainSeed {
  id: string;
  label: string;
  categoryId: string;
  categoryLabel: string;
}

const DOMAIN_SEEDS: DomainSeed[] = [
  { id: "semiconductor", label: "반도체·소부장", categoryId: "hardware", categoryLabel: "딥테크 하드웨어" },
  { id: "battery", label: "이차전지", categoryId: "hardware", categoryLabel: "딥테크 하드웨어" },
  { id: "space", label: "우주항공·해양", categoryId: "energy_space", categoryLabel: "에너지·우주" },
  { id: "hydrogen", label: "수소·에너지", categoryId: "energy_space", categoryLabel: "에너지·우주" },
  { id: "ai", label: "AI·소프트웨어", categoryId: "software", categoryLabel: "소프트웨어·AI" },
  { id: "robotics", label: "로봇·자동화", categoryId: "software", categoryLabel: "소프트웨어·AI" },
  { id: "quantum_telecom", label: "양자·차세대통신", categoryId: "frontier", categoryLabel: "프론티어 기술" },
  { id: "bio", label: "바이오·헬스케어", categoryId: "frontier", categoryLabel: "프론티어 기술" },
  { id: "etc", label: "기타", categoryId: "etc", categoryLabel: "기타" },
];

export const domains: Domain[] = DOMAIN_SEEDS.map((seed) => ({
  ...seed,
  checkpoints: buildCheckpoints(seed.id, seed.label),
}));

export function getDomain(domainId: string): Domain | undefined {
  return domains.find((d) => d.id === domainId);
}

export const domainCategories: DomainCategory[] = Object.values(
  domains.reduce<Record<string, DomainCategory>>((acc, d) => {
    if (!acc[d.categoryId]) {
      acc[d.categoryId] = { categoryId: d.categoryId, categoryLabel: d.categoryLabel, domains: [] };
    }
    acc[d.categoryId].domains.push({ id: d.id, label: d.label });
    return acc;
  }, {})
);
