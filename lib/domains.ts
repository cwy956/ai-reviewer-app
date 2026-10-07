export type CheckpointCategory = "team" | "market" | "product" | "traction" | "finance";

export interface Checkpoint {
  id: string;
  category: CheckpointCategory;
  label: string;
}

export interface SubDomain {
  id: string;
  label: string;
}

export interface Domain {
  id: string;
  label: string;
  categoryId: string;
  categoryLabel: string;
  subDomains: SubDomain[];
  checkpoints: Checkpoint[];
}

export interface DomainCategory {
  categoryId: string;
  categoryLabel: string;
  domains: { id: string; label: string; subDomains: SubDomain[] }[];
}

export const CATEGORY_LABELS: Record<CheckpointCategory, string> = {
  team: "팀",
  market: "시장",
  product: "제품·기술",
  traction: "트랙션",
  finance: "재무·딜",
};

type Specs = { category: CheckpointCategory; texts: string[] }[];

// 영역 종류별 공통 체크포인트. "deeptech"는 기존 9개 영역이 쓰던 문구/순서 그대로(심사역이
// 별표 친 체크포인트 id가 `${domainId}-${category}-${n}`이라 순서를 바꾸면 안 됨).
function deeptechSpecs(label: string): Specs {
  return [
    {
      category: "team",
      texts: [
        `창업자·핵심 인력의 ${label} 도메인 실무 경력이 소속·기간과 함께 기재됨`,
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
        `경쟁사 대비 비교(성능·가격·고객 등)와 자사 포지셔닝이 기재됨`,
        `진입 타이밍 논리(기술·정책·수요 사이클 등)가 기재됨`,
      ],
    },
    {
      category: "product",
      texts: [
        `${label} 밸류체인 내 위치와 한 줄 차별성이 정의됨`,
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
        `수주·계약 파이프라인이 단계별 금액으로 구분되어 기재됨`,
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
        `향후 3~5개년 매출 추정과 그 근거(수주·고객·단가·물량)가 기재됨`,
        `주주구성(대표·핵심 인력·기존 투자자 지분율)이 기재됨`,
        `희망 투자금액과 투자 조건(밸류·단계)이 기재됨`,
      ],
    },
  ];
}

// 양산·TRL·CAPEX 중심의 딥테크 문구가 어울리지 않는 SW·핀테크·보안 영역용.
function softwareSpecs(label: string): Specs {
  return [
    {
      category: "team",
      texts: [
        `창업자·핵심 인력의 ${label} 분야 제품 개발·운영 경력이 소속·기간과 함께 기재됨`,
        `엔지니어링·제품·영업 인력의 구성이 드러남`,
        `CTO·핵심 개발자의 관련 실적이 기재됨`,
        `고객 성공·영업 조직의 구성(또는 채용 계획)이 기재됨`,
        `핵심 인력 유지 장치(지분·스톡옵션 등)가 언급됨`,
      ],
    },
    {
      category: "market",
      texts: [
        `목표 시장 규모(TAM/SAM/SOM)가 근거·출처와 함께 기재됨`,
        `시장 성장률·수요 근거가 정량화되어 기재됨`,
        `이상적 고객 프로필(ICP)·고객 세그먼트가 명확히 기재됨`,
        `경쟁사 대비 비교(성능·가격·고객 등)와 자사 포지셔닝이 기재됨`,
        `도입 타이밍 논리(규제·기술·수요 변화 등)가 기재됨`,
      ],
    },
    {
      category: "product",
      texts: [
        `해결하는 문제와 한 줄 가치 제안이 정의됨`,
        `경쟁 대비 차별성이 정량 지표(정확도·속도·비용 등)로 기재됨`,
        `기술 방어 요소(데이터·특허·IP·네트워크 효과)가 기재됨`,
        `제품 개발 단계와 로드맵이 기재됨`,
        `확장성·보안·규제 준수 현황이 기재됨`,
      ],
    },
    {
      category: "traction",
      texts: [
        `유료 고객·PoC 실적이 고객명·규모와 함께 기재됨`,
        `ARR/MRR·매출 성장이 수치로 기재됨`,
        `리텐션·이탈률(NRR 등)이 기재됨`,
        `파이프라인과 PoC→계약 전환율이 기재됨`,
        `파트너십·레퍼런스 고객이 기재됨`,
      ],
    },
    {
      category: "finance",
      texts: [
        `번레이트·런웨이가 수치로 기재됨`,
        `단위경제(CAC·LTV·매출총이익률)가 기재됨`,
        `pre-밸류/이전 라운드 정보와 밸류 근거가 기재됨`,
        `자금 사용 계획이 항목별로 기재됨`,
        `향후 3~5개년 매출 추정과 그 근거(고객·단가·계약)가 기재됨`,
        `주주구성(대표·핵심 인력·기존 투자자 지분율)이 기재됨`,
        `희망 투자금액과 투자 조건(밸류·단계)이 기재됨`,
      ],
    },
  ];
}

// 브랜드·유통·콘텐츠 등 소비자 대상 사업용 — IR 메일함에 실제로 이런 딜(뷰티 브랜드, 카페,
// 게임 등)이 꾸준히 들어와서 별도 틀을 둠.
function consumerSpecs(label: string): Specs {
  return [
    {
      category: "team",
      texts: [
        `대표·핵심 인력의 ${label} 분야 경력(브랜드·유통·제작 등)이 소속·기간과 함께 기재됨`,
        `상품기획·마케팅·영업 인력의 구성이 드러남`,
        `생산·운영(제조 파트너·제작 조직) 경험자 또는 파트너가 명시됨`,
        `어드바이저·파트너 네트워크가 기재됨`,
        `핵심 인력 유지 장치(지분·스톡옵션 등)가 언급됨`,
      ],
    },
    {
      category: "market",
      texts: [
        `목표 시장 규모(TAM/SAM/SOM)가 근거·출처와 함께 기재됨`,
        `소비 트렌드·수요 근거가 정량화되어 기재됨`,
        `타깃 고객(페르소나)이 명확히 기재됨`,
        `경쟁 브랜드·서비스 대비 포지셔닝이 기재됨`,
        `채널 전략(온·오프라인·해외)이 기재됨`,
      ],
    },
    {
      category: "product",
      texts: [
        `브랜드·제품 컨셉과 한 줄 차별성이 정의됨`,
        `제품 라인업과 핵심 SKU(또는 콘텐츠·서비스 구성)가 기재됨`,
        `원료·제조 방식·품질 관리 또는 인증 현황이 기재됨`,
        `상표·디자인·콘텐츠 IP 현황이 기재됨`,
        `신제품·신규 서비스 로드맵이 기재됨`,
      ],
    },
    {
      category: "traction",
      texts: [
        `매출과 성장률이 채널별로 기재됨`,
        `재구매율·고객 획득비용(CAC)·광고 효율 등 고객 지표가 기재됨`,
        `유통·입점 현황과 계약 규모가 기재됨`,
        `해외 진출·수출 실적 또는 계획이 기재됨`,
        `수상·미디어·팬덤 등 브랜드 인지도 지표가 기재됨`,
        `입점·유통·거래 협의 파이프라인이 단계별로 구분되어 기재됨`,
      ],
    },
    {
      category: "finance",
      texts: [
        `매출총이익률·영업이익률 등 단위경제가 기재됨`,
        `재고·운전자본·번레이트가 수치로 기재됨`,
        `pre-밸류/이전 라운드 정보와 밸류 근거가 기재됨`,
        `자금 사용 계획(마케팅·생산·R&D)이 항목별로 기재됨`,
        `손익분기 시점과 향후 3~5개년 매출 추정(근거 포함)이 기재됨`,
        `주주구성(대표·핵심 인력·기존 투자자 지분율)이 기재됨`,
        `희망 투자금액과 투자 조건(밸류·단계)이 기재됨`,
      ],
    },
  ];
}

type SpecKind = "deeptech" | "software" | "consumer";

const SPEC_BUILDERS: Record<SpecKind, (label: string) => Specs> = {
  deeptech: deeptechSpecs,
  software: softwareSpecs,
  consumer: consumerSpecs,
};

type Extras = Partial<Record<CheckpointCategory, string[]>>;

// 영역별 고유 체크포인트 — 공통 5개 뒤에 6번부터 이어 붙임(기존 id가 밀리지 않게).
const EXTRA_CHECKPOINTS: Record<string, Extras> = {
  semiconductor: {
    market: ["응용처(차량·AI·산업 등)별 수요 전망이 기재됨"],
    product: ["설계 공정 노드와 핵심 사양(성능·전력·면적)이 기재됨", "팹·OSAT 등 제조 파트너와 양산 경로가 기재됨"],
    traction: ["고객사 퀄 테스트·샘플 평가 단계가 기재됨", "디자인 윈(Design-in) 또는 양산 승인 실적이 기재됨"],
    finance: ["마스크·테이프아웃·웨이퍼 비용 등 개발비 구조가 기재됨"],
  },
  display: {
    market: ["적용처(차량·XR·웨어러블 등)별 채택 시점 전망이 기재됨"],
    product: ["휘도·수명·해상도 등 핵심 성능 지표가 경쟁 기술과 비교되어 기재됨", "공정 수율과 양산 라인 확보 현황이 기재됨"],
    traction: ["세트·모듈 업체의 샘플 평가·양산 협의 단계가 기재됨"],
  },
  battery: {
    market: ["원재료(리튬·니켈 등) 조달과 가격 변동 대응이 기재됨"],
    product: ["에너지밀도·사이클 수명·안전성(열폭주 등) 지표가 기재됨", "파일럿→GWh급 양산 스케일업 단계가 기재됨"],
    traction: ["셀 메이커·완성차의 퀄·샘플 테스트 단계가 기재됨"],
    finance: ["라인 증설 CAPEX와 kWh당 원가 구조가 기재됨", "수출 규제·원산지 규정 대응이 기재됨"],
  },
  materials: {
    product: ["물성 지표(강도·내열·전도 등)가 기존 소재 대비 비교되어 기재됨", "스케일업과 공정 재현성(배치 간 편차)이 기재됨"],
    traction: ["수요처 인증·평가(퀄) 단계가 기재됨", "대체재 대비 원가 경쟁력이 기재됨"],
    market: ["환경·화학물질 규제(REACH 등) 대응이 기재됨"],
  },
  robotics: {
    market: ["도입 고객의 투자회수(ROI) 기간 근거가 기재됨"],
    product: ["정밀도·페이로드·가동시간 등 사양과 안전 인증이 기재됨", "핵심 부품(감속기·모터 등)의 내재화·조달 구조가 기재됨"],
    traction: ["고객 현장 적용·PoC 실적이 기재됨", "설치 후 유지보수·서비스 체계가 기재됨"],
    finance: ["하드웨어 마진과 RaaS 등 반복 매출 구조가 기재됨"],
  },
  mobility: {
    market: ["규제·인프라(충전망·노선·법규) 전제 조건이 기재됨"],
    product: ["차량·항공 관련 인증·법규(자율주행 레벨, 형식승인 등) 현황이 기재됨", "완성차·Tier1 납품 경로가 기재됨"],
    traction: ["OEM 개발 프로젝트·양산 채택(Design-win) 실적이 기재됨", "실증 주행·운행 데이터가 기재됨"],
  },
  smart_mfg: {
    market: ["업종별 확산 가능성(반복 판매 vs 맞춤형 구축)이 기재됨"],
    product: ["적용 공정과 생산성·불량률 개선 효과가 수치로 기재됨", "기존 설비·MES/ERP 연동성이 기재됨"],
    traction: ["고객 공장 도입 사례와 ROI가 기재됨"],
  },
  space: {
    product: ["발사·궤도 운용 실적 또는 비행·환경 시험 단계가 기재됨", "항공·우주 품질 인증(AS9100 등) 현황이 기재됨"],
    traction: ["발주처(정부·민간) 계약과 개발 일정이 기재됨"],
    finance: ["장기 개발비와 마일스톤별 자금 조달 계획이 기재됨"],
  },
  hydrogen: {
    market: ["정책·보조금 의존도와 변동 시 영향이 기재됨"],
    product: ["효율·내구성·단가(kg당·kWh당) 지표가 기재됨", "실증 규모(kW→MW)와 운전 이력이 기재됨"],
    traction: ["오프테이커·PPA·공급 계약 실적이 기재됨", "인허가·안전 규제 대응 현황이 기재됨"],
    finance: ["프로젝트 파이낸싱 구조와 LCOE/LCOH 근거가 기재됨"],
  },
  climate: {
    market: ["규제·탄소가격 전제와 민감도가 기재됨"],
    product: ["감축·처리 효과가 정량 지표와 검증 방식으로 기재됨"],
    traction: ["인증·크레딧 발급 실적 또는 규제 대응 고객이 기재됨"],
    finance: ["정책·보조금 의존 비중이 기재됨"],
  },
  ai: {
    product: ["모델 성능·정확도가 벤치마크로 비교되어 기재됨", "학습 데이터 확보 경로와 권리(저작권·개인정보) 현황이 기재됨", "외부 모델(API) 의존도와 대체 가능성이 기재됨"],
    traction: ["PoC→유료 전환 실적이 기재됨"],
    finance: ["AI 추론·학습 비용(GPU 등) 구조와 마진 영향이 기재됨"],
  },
  security: {
    market: ["규제 수요(망분리·ISMS-P 등) 근거가 기재됨"],
    product: ["탐지율·오탐률 등 성능 지표와 보안 인증(CC 등) 현황이 기재됨"],
    traction: ["공공·금융 등 레퍼런스 고객이 기재됨", "구독 매출·갱신율이 기재됨"],
  },
  fintech: {
    product: ["인허가·라이선스(전금업·대부업·마이데이터 등) 확보 현황이 기재됨", "리스크·건전성 관리(연체율·사기율 등) 체계가 기재됨"],
    traction: ["거래액(GMV)·가입자·수수료 수익이 기재됨"],
    finance: ["자본 요건과 자금 조달 비용·마진 구조가 기재됨"],
  },
  quantum_telecom: {
    market: ["상용화 시점과 연구비·정부과제 의존도가 기재됨"],
    product: ["큐비트 수·오류율·결맞음 시간 등 핵심 성능 지표가 기재됨", "극저온·광원 등 핵심 부품 조달·내재화 구조가 기재됨"],
    traction: ["연구기관·기업 PoC와 클라우드 접근 제공 등 이용 실적이 기재됨"],
  },
  telecom: {
    market: ["통신사·장비사 투자 사이클과 표준 일정이 기재됨"],
    product: ["대역폭·지연·전력 등 통신 성능 지표가 경쟁 기술과 비교되어 기재됨"],
    traction: ["통신사·장비사 PoC와 표준화·인증 참여가 기재됨"],
  },
  nuclear: {
    market: ["인허가·규제 일정과 정책 의존도가 기재됨"],
    product: ["안전성·인허가 단계(설계 인증, 규제기관 심사)가 기재됨", "핵심 기자재·소재의 공급망과 품질 인증(ASME·원자력 품질보증)이 기재됨"],
    traction: ["발주처·해외 프로젝트 참여 실적이 기재됨"],
    finance: ["장기 개발·인허가 비용과 마일스톤별 자금 조달 계획이 기재됨"],
  },
  bio: {
    product: [
      "파이프라인별 개발 단계(전임상·임상 1/2/3상)와 적응증이 기재됨",
      "작용기전·타깃 근거와 경쟁 약물 대비 차별성이 기재됨",
    ],
    traction: ["기술이전(L/O)·공동개발 계약과 마일스톤이 기재됨", "임상 일정과 허가 전략이 기재됨"],
    finance: ["임상 단계별 비용과 자금 소요, 주요 결과 발표 일정이 기재됨"],
  },
  medtech: {
    market: ["보험 급여·수가 전략이 기재됨"],
    product: ["인허가 단계(식약처·FDA·CE)와 임상 근거가 기재됨"],
    traction: ["병원·의료기관 도입 실적이 기재됨", "디지털헬스는 사용자·활성 지표가 기재됨"],
    finance: ["인허가·임상 비용과 상용화 시점이 기재됨"],
  },
  beauty: {
    product: ["처방·원료 차별성과 안전성·인증(비건·동물실험 배제 등) 현황이 기재됨", "제조 위탁(ODM·OEM) 구조와 의존도가 기재됨"],
    traction: ["채널별 매출(자사몰·올리브영·해외 등)과 재구매율이 기재됨", "해외 인증·수출 실적이 기재됨"],
  },
  food: {
    product: ["원료·공정 차별성과 식품 안전 인증(HACCP 등)이 기재됨", "생산 CAPA와 원료 조달 구조가 기재됨"],
    traction: ["유통 입점·B2B 납품 실적이 기재됨"],
    finance: ["생산 단위당 원가와 마진 구조가 기재됨"],
  },
  content: {
    product: ["IP·콘텐츠 라인업과 개발·출시 단계가 기재됨", "플랫폼 수수료·배급 구조가 기재됨"],
    traction: ["MAU·DAU·결제 전환율·ARPU가 기재됨", "퍼블리싱·배급 계약이 기재됨"],
    finance: ["제작비·마케팅비 회수 구조가 기재됨"],
  },
  commerce: {
    product: ["공급·수요 양면 확보 방식과 핵심 차별성이 기재됨"],
    traction: ["GMV·테이크레이트·재구매율이 기재됨", "공급자·파트너 수와 성장이 기재됨"],
    finance: ["공헌이익 기준 단위경제와 물류·운영비 구조가 기재됨"],
  },
};

function buildCheckpoints(domainId: string, kind: SpecKind, domainLabel: string): Checkpoint[] {
  const extras = EXTRA_CHECKPOINTS[domainId] ?? {};
  return SPEC_BUILDERS[kind](domainLabel).flatMap((spec) => {
    const texts = [...spec.texts, ...(extras[spec.category] ?? [])];
    return texts.map((text, i) => ({
      id: `${domainId}-${spec.category}-${i + 1}`,
      category: spec.category,
      label: text,
    }));
  });
}

interface DomainSeed {
  id: string;
  label: string;
  categoryId: string;
  categoryLabel: string;
  kind?: SpecKind;
  subs: string[];
}

// 대분류는 12대 국가전략기술(과기정통부) + 기타. 중분류가 평가·라우팅 단위(domain id), 소분류는
// 세부 영역. 기존 9개 영역 id는 DB·담당자 별표 설정이 참조하므로 유지 — 특히 quantum_telecom은
// 예전 "양자·차세대통신" id를 그대로 두고 양자 전용으로 쓰며 차세대통신은 telecom으로 분리.
// 12대 분야에 없는 업종(소재·기후·핀테크·소비재 등)은 "기타" 대분류 아래 중분류로 둠.
const DOMAIN_SEEDS: DomainSeed[] = [
  // 반도체·디스플레이
  { id: "semiconductor", label: "반도체·소부장", categoryId: "semi_display", categoryLabel: "반도체·디스플레이",
    subs: ["시스템반도체·팹리스", "AI반도체·NPU", "메모리·차세대메모리", "전력반도체(SiC·GaN)", "파운드리·첨단패키징", "반도체 소재·부품", "반도체 장비", "센서·MEMS"] },
  { id: "display", label: "디스플레이·광학", categoryId: "semi_display", categoryLabel: "반도체·디스플레이",
    subs: ["OLED·마이크로LED", "차량·XR용 디스플레이", "광학 소재·부품", "라이다·광센서", "AR/VR 광학"] },
  // 이차전지
  { id: "battery", label: "이차전지", categoryId: "battery", categoryLabel: "이차전지",
    subs: ["양극·음극 소재", "전해질·분리막", "전고체·차세대 전지", "셀·팩 제조", "배터리 장비", "BMS·ESS", "재활용·재사용"] },
  // 첨단 모빌리티
  { id: "mobility", label: "첨단 모빌리티", categoryId: "mobility", categoryLabel: "첨단 모빌리티",
    subs: ["전기차·전장부품", "자율주행·ADAS", "UAM·미래항공 모빌리티", "충전 인프라", "마이크로모빌리티", "차량용 소프트웨어"] },
  // 차세대 원자력
  { id: "nuclear", label: "차세대 원자력", categoryId: "nuclear", categoryLabel: "차세대 원자력",
    subs: ["SMR(소형모듈원전)", "원전 기자재·소재", "핵융합", "방사성폐기물·해체", "원자력 안전·SW"] },
  // 첨단 바이오
  { id: "bio", label: "바이오·신약", categoryId: "bio", categoryLabel: "첨단 바이오",
    subs: ["저분자 신약", "항체·바이오의약품", "세포·유전자 치료", "백신·감염병", "합성생물학·바이오소재", "체외진단(IVD)"] },
  { id: "medtech", label: "의료기기·디지털헬스", categoryId: "bio", categoryLabel: "첨단 바이오",
    subs: ["의료기기·영상장비", "AI 진단·의료 SW", "디지털치료제", "원격의료·헬스케어 플랫폼", "웨어러블·헬스케어 디바이스", "시니어·재활"] },
  // 우주항공·해양
  { id: "space", label: "우주항공·해양", categoryId: "space", categoryLabel: "우주항공·해양",
    subs: ["위성·지상국·데이터", "발사체·추진", "항공기 부품·MRO", "해양플랜트·조선", "해양장비·수중로봇", "우주 소재·부품"] },
  // 수소
  { id: "hydrogen", label: "수소·에너지", categoryId: "hydrogen", categoryLabel: "수소",
    subs: ["수전해·수소 생산", "수소 저장·운송", "연료전지", "태양광", "풍력·해상풍력", "ESS·전력망·VPP"] },
  // 사이버보안
  { id: "security", label: "사이버보안·네트워크", categoryId: "security", categoryLabel: "사이버보안", kind: "software",
    subs: ["네트워크·엔드포인트 보안", "클라우드·데이터 보안", "암호·인증(양자내성암호)", "OT·산업 보안", "보안 관제·위협 인텔리전스"] },
  // 인공지능
  { id: "ai", label: "AI·소프트웨어", categoryId: "ai", categoryLabel: "인공지능",
    subs: ["생성형AI·LLM", "비전·영상 AI", "산업·제조 AI", "음성·언어 AI", "데이터·MLOps", "B2B SaaS", "클라우드·인프라", "AI 에이전트·자동화"] },
  // 차세대 통신
  { id: "telecom", label: "차세대 통신", categoryId: "telecom", categoryLabel: "차세대 통신",
    subs: ["6G·Open RAN", "위성통신", "광통신·네트워크 장비", "무선·RF 부품", "통신 SW·코어망"] },
  // 첨단 로봇·제조
  { id: "robotics", label: "로봇·자동화", categoryId: "robot_mfg", categoryLabel: "첨단 로봇·제조",
    subs: ["산업용·협동 로봇", "서비스·물류 로봇", "휴머노이드·AI 로봇", "로봇 핵심부품(감속기·모터)", "드론·무인 시스템", "의료·재활 로봇"] },
  { id: "smart_mfg", label: "스마트제조·장비", categoryId: "robot_mfg", categoryLabel: "첨단 로봇·제조",
    subs: ["공정 자동화·MES", "머신비전·검사", "산업용 장비·설비", "3D프린팅·적층제조", "디지털트윈·시뮬레이션", "예지보전·산업 AI"] },
  // 양자 (id는 예전 "양자·차세대통신" 것을 유지)
  { id: "quantum_telecom", label: "양자", categoryId: "quantum", categoryLabel: "양자",
    subs: ["양자컴퓨팅", "양자통신·암호", "양자센서", "양자 소재·부품(극저온·광원)"] },
  // 기타 — 12대 분야에 없는 업종
  { id: "materials", label: "첨단소재·화학", categoryId: "etc", categoryLabel: "기타",
    subs: ["나노·탄소 소재", "복합소재", "고분자·특수화학", "금속·세라믹", "코팅·표면처리", "친환경·바이오 소재"] },
  { id: "climate", label: "기후·환경", categoryId: "etc", categoryLabel: "기타",
    subs: ["탄소포집·활용(CCUS)", "폐기물·순환경제", "수처리·대기환경", "탄소배출 측정·크레딧", "친환경 건축·건설"] },
  { id: "fintech", label: "핀테크", categoryId: "etc", categoryLabel: "기타", kind: "software",
    subs: ["결제·송금", "대출·투자 플랫폼", "보험테크", "블록체인·가상자산", "금융 AI·RegTech", "B2B 금융 인프라"] },
  { id: "beauty", label: "뷰티·패션", categoryId: "etc", categoryLabel: "기타", kind: "consumer",
    subs: ["스킨케어·화장품", "헤어·바디 케어", "뷰티 디바이스", "패션·어패럴", "라이프스타일 브랜드"] },
  { id: "food", label: "푸드·농업", categoryId: "etc", categoryLabel: "기타", kind: "consumer",
    subs: ["푸드테크·대체식품", "스마트팜·농업기술", "식품 제조·건강기능식품", "F&B·외식 브랜드", "반려동물"] },
  { id: "content", label: "게임·콘텐츠·미디어", categoryId: "etc", categoryLabel: "기타", kind: "consumer",
    subs: ["게임", "웹툰·영상 콘텐츠", "음악·엔터테인먼트", "메타버스·XR 콘텐츠", "크리에이터·미디어 플랫폼"] },
  { id: "commerce", label: "커머스·플랫폼·서비스", categoryId: "etc", categoryLabel: "기타", kind: "consumer",
    subs: ["이커머스·D2C", "여행·예약·관광", "교육·에듀테크", "프롭테크·건설 서비스", "물류·유통", "HR·B2B 서비스"] },
  { id: "etc", label: "그 외 기타", categoryId: "etc", categoryLabel: "기타", subs: [] },
];

function slug(index: number): string {
  return `s${index + 1}`;
}

export const domains: Domain[] = DOMAIN_SEEDS.map((seed) => ({
  id: seed.id,
  label: seed.label,
  categoryId: seed.categoryId,
  categoryLabel: seed.categoryLabel,
  subDomains: seed.subs.map((label, i) => ({ id: `${seed.id}.${slug(i)}`, label })),
  checkpoints: buildCheckpoints(seed.id, seed.kind ?? "deeptech", seed.label),
}));

export function getDomain(domainId: string): Domain | undefined {
  return domains.find((d) => d.id === domainId);
}

export function getSubDomain(domainId: string, subDomainId: string): SubDomain | undefined {
  return getDomain(domainId)?.subDomains.find((s) => s.id === subDomainId);
}

export const domainCategories: DomainCategory[] = Object.values(
  domains.reduce<Record<string, DomainCategory>>((acc, d) => {
    if (!acc[d.categoryId]) {
      acc[d.categoryId] = { categoryId: d.categoryId, categoryLabel: d.categoryLabel, domains: [] };
    }
    acc[d.categoryId].domains.push({ id: d.id, label: d.label, subDomains: d.subDomains });
    return acc;
  }, {})
);
