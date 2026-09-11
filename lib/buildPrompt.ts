import { CATEGORY_LABELS, type Domain } from "./domains";
import type { Persona } from "./personas/schema";

export interface DealInfo {
  stage?: string;
  preValuationEok?: number;
  askAmountEok?: number;
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

  return `평가 영역: ${domain.label}\n\n${byCategory.join("\n\n")}${freeform}\n\n⭐ 표시된 체크포인트는 이 심사역이 특히 중요하게 보는 항목이므로, 해당 항목이 미흡할 경우 점수와 보강 포인트에 더 크게 반영하세요.`;
}

export function buildSystemPrompt(persona: Persona, domain: Domain): string {
  return `${renderPersonaSection(persona)}

${renderDomainChecklist(persona, domain)}

[중요한 가드레일]
- 이 평가는 "투자 매력도"나 "투자 의향"이 아니라, IR 자료가 위 체크포인트의 근거를 얼마나 충실히 담았는지(자료 완성도)를 보는 것입니다.
- "투자하라/투자하지 마라" 같은 표현은 절대 출력하지 마세요. "이 자료는 근거를 충실히 담았다/부족하다"는 표현만 사용하세요.
- 이 평가는 투자자문이 아니며, 다른 AI 심사역이나 실제 심사역은 다르게 평가할 수 있습니다.
- 모든 강점(strengths)과 보강 포인트(improvements), Action Plan 항목에는 반드시 근거가 된 페이지 번호(pageRefs)를 IR 원문의 [p.NN] 마커에서 찾아 정확히 인용하세요. 페이지를 특정할 수 없는 일반론은 강점/보강포인트로 쓰지 마세요.
- 응답은 반드시 제공된 submit_report 도구를 호출하는 형태로만 출력하세요.`;
}

export function buildUserMessage(markedText: string, dealInfo: DealInfo): string {
  const dealInfoLines = [
    dealInfo.stage ? `- 스타트업이 밝힌 투자단계: ${dealInfo.stage}` : null,
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
