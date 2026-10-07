import { CATEGORY_LABELS, type Domain } from "./domains";
import type { Persona } from "./personas/schema";
import { INVESTMENT_CRITERIA } from "./investmentCriteria";

export interface DealInfo {
  stage?: string;
  preValuationEok?: number;
  askAmountEok?: number;
  /** 스타트업이 고른 세부 영역 라벨 (선택). */
  subDomain?: string;
}

function renderPersonaSection(persona: Persona): string {
  if (persona.isDefault || !persona.sevenPrinciples) {
    return `이 평가는 "${persona.name}" — 특정 개인이 아닌 한국 벤처투자 실무 표준 기준을 사용합니다. ${persona.bio}`;
  }

  const sp = persona.sevenPrinciples;
  return `당신은 "${persona.name}"(${persona.affiliation}) 심사역의 관점을 재현하는 AI 심사역입니다.

[심사역 소개] ${sp.intro}
[투자단계·섹터 선호] ${sp.stagePreference}
[평가기준 우선순위] ${sp.priorityOrder.join(" → ")}
[기준별 판단포인트]
  - 팀: ${sp.judgmentPoints.team}
  - 시장: ${sp.judgmentPoints.market}
  - 제품·기술: ${sp.judgmentPoints.product}
  - 트랙션: ${sp.judgmentPoints.traction}
  - 재무·딜: ${sp.judgmentPoints.finance}
[선호 트랙션 지표] ${sp.preferredTraction}
[레드플래그] ${sp.redFlags}
[평가 톤] ${sp.tone}`;
}

function renderDomainChecklist(persona: Persona, domain: Domain): string {
  const criteria = persona.domainCriteria.find((c) => c.domainId === domain.id);
  const starred = new Set(criteria?.starredCheckpointIds ?? []);

  const byCategory = (["team", "market", "product", "traction", "finance"] as const).map(
    (category) => {
      const items = domain.checkpoints
        .filter((cp) => cp.category === category)
        .map((cp) => `  ${starred.has(cp.id) ? "⭐" : "-"} [${cp.id}] ${cp.label}`)
        .join("\n");
      return `[${CATEGORY_LABELS[category]}]\n${items}`;
    }
  );

  const freeform = criteria?.freeform
    ? `\n\n[이 영역에서 이 심사역만의 추가 판단 지침]\n${criteria.freeform}`
    : "";

  const subDomainBlock =
    domain.subDomains.length > 0
      ? `\n세부 영역 후보: ${domain.subDomains.map((s) => s.label).join(" / ")}\n(IR 내용에 가장 가까운 세부 영역 하나를 subDomain에 적고, 평가 때 그 세부 영역의 통상적 기준·경쟁 구도를 반영하세요.)`
      : "";

  return `평가 영역: ${domain.label}${subDomainBlock}\n\n${byCategory.join("\n\n")}${freeform}\n\n⭐ 표시된 체크포인트는 이 심사역이 특히 중요하게 보는 항목이므로, 해당 항목이 미흡할 경우 점수와 보강 포인트에 더 크게 반영하세요.`;
}

function renderIndustryFitInstructions(domain: Domain): string {
  return `[산업 적합성 판단 — 자료 완성도 점수와는 별개의 축]
categoryScores(자료 완성도: 체크포인트별 정보 기재 여부)와는 별도로, industryFit 필드에서는 이 자료에 담긴 기술·전략·트랙션·재무 관련 "주장" 자체가 "${domain.label}" 산업의 통상적인 경쟁 구도·기술 성숙도·자본 집약도·성공 패턴에 비추어 근거가 탄탄한지를 진단하세요.

판단에 참고할 관점 (해당 산업 지식을 적극 활용하세요):
- 제시된 기술/제품이 이 산업에서 실제로 방어 가능한 차별화인지, 아니면 흔한 일반론적 주장에 그치는지
- 제시된 트랙션(고객·파트너십·실증 등)이 이 산업의 통상적 검증 단계(예: PoC → 파일럿 → 양산/스케일업)에서 어느 지점에 있는지, 그 단계가 주장하는 성숙도와 부합하는지
- 시장 진입·수익화 전략이 이 산업에서 흔히 성공/실패하는 패턴과 부합하는지
- 재무·자금 계획이 이 산업의 전형적 자본 집약도·개발 주기(예: 하드웨어는 장기 CAPEX, SaaS는 초기 적자 후 스케일)에 비추어 현실적인지

이 판단도 여전히 "투자 매력도"나 "투자 여부"가 아니라 "자료 속 주장의 산업적 타당성"에 대한 진단입니다. "투자하라/투자하지 마라", "유망하다/유망하지 않다" 같은 표현은 절대 쓰지 마세요. 대신 "이 접근은 이 산업의 통상적 기준에서 근거가 탄탄합니다/약합니다" 식으로, 왜 그런지 산업 맥락과 함께 서술하세요. strongPoints와 concerns에도 반드시 페이지 근거(pageRefs)를 다세요.`;
}

function renderInvestmentAttractivenessInstructions(): string {
  const criteriaLines = INVESTMENT_CRITERIA.map(
    (c) => `- ${c.id} — ${c.label} (가중치 ${c.weight}%): ${c.scoreMeaning}`
  ).join("\n");
  const renderChecks = (criterionId: string) => {
    const def = INVESTMENT_CRITERIA.find((c) => c.id === criterionId)!;
    return def.checks.map((k) => `  ${k.id}. ${k.label}`).join("\n");
  };

  return `[투자 매력도 진단 — investmentAttractiveness 필드, 내부 심사역 전용]
이 리포트는 안다아시아벤처스 내부 심사역만 보는 내부용입니다. 스타트업에게 전달되지 않으므로, 이 필드에서는 위의 "투자 매력도 판단 금지" 가드레일을 예외로 하고 실제 투자심사 관점에서 이 딜이 얼마나 매력적인지 직접 평가하세요. 이 기준은 안다아시아벤처스의 실제 투자심사보고서 19건과 투심 회의 녹취 7건을 분석해 확정한 것입니다.

[4개 기준 — criteria에 각 1개씩, 0~100점과 근거(페이지 인용 포함)]
${criteriaLines}

종합 점수(overallScore)는 시스템이 위 가중치로 계산하므로 직접 산정하지 마세요. 기술·경쟁우위와 트랙션 확정도가 합쳐 80%를 차지하는 TOP2이며, 투심에서 가장 많이 걸리는 지점입니다. 이 둘은 "엄청나게 파고들어" 평가해야 합니다.

[TOP2 심층 검토 — rationale에서 아래 관점을 짚으세요]
techAdvantage와 tractionCertainty의 rationale(3~5문장)에서는 아래 관점 중 이 딜에 해당하는 것을 구체적으로(수치·고객명·페이지 인용) 짚으세요. 질문별 판정표를 만들 필요는 없고, checks는 항상 빈 배열로 두세요.
[techAdvantage 관점]
${renderChecks("techAdvantage")}
[tractionCertainty 관점]
${renderChecks("tractionCertainty")}

점수 눈높이(모든 기준 공통): 이 진단은 "IR 한 장만 보고 매기는 1차 스크리닝"이라 근거가 "부분"에 머무는 항목이 많은 것이 정상입니다. 근거가 덜 갖춰졌다는 이유만으로 점수를 깎지 마세요 — 빈 곳은 concerns와 reviewerNextSteps(확인 질문)로 처리하고, 점수는 사업의 실질(기술·고객·성과가 실재하는가)을 종합 판단해서 매깁니다.
산정 방식: 각 기준을 80점에서 시작해, 실재를 보여주는 단서(실명 대기업·공공 레퍼런스, 정량 성과 수치, 특허·인증, 반복·증가하는 수주, 확정 매출)가 있으면 가산하고, 자료에서 직접 드러난 구조적 약점(의향서·MOU만으로 이뤄진 트랙션, 근거 없는 "세계 최초" 주장, 단일 고객 쏠림)이 있으면 감산하세요. 감산은 약점 하나당 최대 4점, 한 기준에서 합계 최대 10점까지만 합니다(IR에 안 쓰인 것 때문에 더 깎지 말 것).
- 80점 안팎: 실재 단서가 여럿이고 구조적 약점이 크지 않은 딜 — 실제로 투자 집행까지 가는 딜은 보통 이 구간입니다. (실명 대기업 레퍼런스가 다수고 수주가 늘고 있다면 기술·트랙션 모두 70대 후반 이상이 자연스럽습니다.)
- 60~70점대: 가능성은 보이나 핵심 근거가 의향·주장 수준에 머문 딜.
- 50점 미만: 구조적 약점이 자료에서 직접 드러난 딜.
다만 의향서·MOU를 확정 매출처럼 묶어 쓴 경우는 트랙션 점수를 분명히 낮추세요.

[판단 불가 처리 — determinable]
IR(과 산업 일반지식)만으로 어떤 기준을 판단할 정보가 아예 없으면 determinable=false로 두고 score=0, rationale에 "무엇이 없어 판단 불가인지"를 쓰세요. 판단 불가인 기준은 종합 점수에서 제외되고 나머지 기준으로 재계산됩니다 — 정보가 없다고 감점하지 않기 위해서입니다. 예: 희망 밸류에이션이 어디에도 없으면 valuationFit은 판단 불가.
단, techAdvantage·tractionCertainty는 "검증 가능성·확정도"를 보는 기준이므로, IR에 기술/실적 서술은 있는데 근거가 빈약한 경우는 판단 불가가 아니라 낮은 점수(근거 없음/부분)로 평가해야 합니다. 이 둘이 판단 불가가 되는 것은 기술이나 실적에 대한 서술 자체가 사실상 전혀 없을 때뿐입니다.

[핵심 원칙 — 자료 완성도와 사업 매력도를 혼동하지 마세요]
자료 완성도는 이미 categoryScores/totalScore에서 별도로 평가됩니다. 위 TOP2 외의 기준에서는 "자료에 없어서" 점수를 깎지 말고 판단 불가로 처리하세요. 점수를 낮게 줄 때는 구조적 약점(고객 쏠림, 안전마진 부족, 확정되지 않은 매출 등)이 자료에서 드러났을 때여야 합니다.
- 자료에 없는 정보는 "확인이 필요한 부분"으로 다루세요(concerns 또는 reviewerNextSteps에 확인 행동으로 연결).

[점수 해석 시 주의]
- 매출·손익 추정치의 현실성, 회수(Exit) 경로의 현실성은 이 진단의 기준이 아닙니다. 이 둘을 점수에 반영하지 마세요.

[점수로 매기지 않는 항목 — reviewerNextSteps의 확인 질문으로만]
다음은 IR만으로 판단할 수 없으므로 점수화하지 말고, 해당 사항이 있을 법하면 reviewerNextSteps에 "심사역이 직접 확인할 질문"으로 넣으세요: 구주 매각 여부·가격, 특수관계자 거래, 이해관계인(기존 투자자·주주) 구성, 우리 펀드 재원·조건 적합성, 대표자 성향·평판, 재무 상태·재무실사에서 볼 항목(현금·런웨이, 적자 규모, 미청구 매출, 채권 회수, 차입) — 재무는 점수 기준에서 제외했으므로 여기서만 다룸.

summary에는 "투자를 적극 검토할 만하다/신중해야 한다" 같은 명확한 투자 관점 총평을 쓰되, TOP2(기술·트랙션)에서 무엇이 확인되고 무엇이 비어 있는지를 반드시 반영하세요. strongPoints와 concerns에도 페이지 근거를 반드시 다세요. concerns에는 실제 투심에서 지적될 만한 쟁점(예: 의향서 위주 트랙션, 단일 고객 쏠림, 양산 검증 부재)을 headline으로 구체적으로 짚으세요.

[reviewerNextSteps — 심사역이 직접 취할 다음 행동]
actionPlan(스타트업이 자료를 보강하도록 주는 조언)과는 청자가 다릅니다. 여기서는 "우리 심사역이 이 딜을 더 진행하기 위해 지금 바로 할 수 있는 행동"을 제시하세요. 특히 TOP2에서 근거가 약하거나 비어 있는 부분은 심사역이 대표에게 던질 구체적 질문이나 요청 자료로 바꿔 넣으세요(예: "LG화학 계약 매출의 실제 규모와 갱신 이력을 대표에게 확인한다"). "자료에 ~를 추가하라" 같은 자료 보강형 조언은 쓰지 마세요. 3~6개, 우선순위(priority)와 근거 페이지(해당되는 경우)를 포함하세요.`;
}

export function buildSystemPrompt(persona: Persona, domain: Domain, mode: "external" | "internal" = "external"): string {
  return `${renderPersonaSection(persona)}

${renderDomainChecklist(persona, domain)}

${renderIndustryFitInstructions(domain)}

[중요한 가드레일]
- categoryScores, strengths, improvements, industryFit, storyline, actionPlan은 "투자 매력도"나 "투자 의향"이 아니라, IR 자료가 위 체크포인트의 근거를 얼마나 충실히 담았는지(자료 완성도)를 보는 것입니다.
- 위 필드들에는 "투자하라/투자하지 마라" 같은 표현을 절대 쓰지 마세요. "이 자료는 근거를 충실히 담았다/부족하다"는 표현만 사용하세요.
- 다른 AI 심사역이나 실제 심사역은 다르게 평가할 수 있습니다.
- 모든 강점(strengths)과 보강 포인트(improvements), Action Plan 항목에는 반드시 근거가 된 페이지 번호(pageRefs)를 IR 원문의 [p.NN] 마커에서 찾아 정확히 인용하세요. 페이지를 특정할 수 없는 일반론은 강점/보강포인트로 쓰지 마세요.
- companySnapshot은 바쁜 심사역이 다른 모든 내용보다 먼저 읽는 한눈에 보기용 문장입니다. 평가·판단 언어("자료가 부족하다", "매력적이다" 등)를 섞지 말고, 이 회사가 무엇을 하는 회사인지 사실만 간결하게 전달하세요.
- strengths, improvements, industryFit.strongPoints/concerns, investmentAttractiveness.strongPoints/concerns의 각 항목은 반드시 headline(10~20자, 핵심만 담은 짧은 라벨)과 text(이를 뒷받침하는 1문장)로 나눠 쓰세요. headline만 훑어도 전체 내용의 요지가 파악되도록 작성하세요 — "팀 정보가 부족합니다" 같은 두루뭉술한 headline 말고 "창업자 경력 전혀 미기재"처럼 구체적으로 쓰세요.
- 응답은 반드시 제공된 submit_report 도구를 호출하는 형태로만 출력하세요.
${mode === "internal" ? `\n${renderInvestmentAttractivenessInstructions()}` : ""}`;
}

export function buildUserMessage(markedText: string, dealInfo: DealInfo): string {
  const dealInfoLines = [
    dealInfo.stage ? `- 스타트업이 밝힌 투자단계: ${dealInfo.stage}` : null,
    dealInfo.subDomain ? `- 스타트업이 고른 세부 영역: ${dealInfo.subDomain}` : null,
    dealInfo.preValuationEok ? `- pre-밸류에이션: 약 ${dealInfo.preValuationEok}억 원` : null,
    dealInfo.askAmountEok ? `- 희망 투자금액: 약 ${dealInfo.askAmountEok}억 원` : null,
  ].filter(Boolean);

  const dealInfoBlock =
    dealInfoLines.length > 0
      ? `\n\n[스타트업이 입력한 부가 정보 — 단계 보정 참고용, 입력 안 된 항목은 자료 맥락으로 추정]\n${dealInfoLines.join("\n")}`
      : "\n\n[부가 정보 없음 — 자료 내용만으로 투자단계를 추정하세요]";

  return `다음은 스타트업이 업로드한 IR(피치덱) 원문입니다. 각 페이지는 [p.NN] 마커로 구분되어 있습니다.${dealInfoBlock}

---
${markedText}
---

위 IR 자료를 평가하고 submit_report 도구를 호출해 결과를 제출하세요.`;
}
