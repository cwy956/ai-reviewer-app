import { listPersonas } from "../personas/store";
import { listAdminTeamMembers } from "../adminTeam/store";
import { teamOf, type ClassifiedMail } from "./classify";

export interface RecipientGroup {
  email: string;
  recipientName: string;
  team: "investment" | "admin";
  mails: ClassifiedMail[];
}

/**
 * Groups classified mails by who should receive them:
 * - ir mails: every registered reviewer with an email (담당자 관리) — 영역별 담당 구분 없이 투자팀 전원에게.
 *   (AI 심사역이 모든 영역을 평가하므로 영역으로 나누지 않음.) 등록된 심사역이 없으면 관리팀이 받음.
 * - invest_other (데모데이·LP/출자 참여 등): 위와 동일 — 이메일이 등록된 심사역 전원.
 * - gov_program / biz_proposal / etc: every registered admin team member (onboarding page).
 * - spam: never routed anywhere.
 * Callers should already have filtered out internal-domain senders before calling this.
 */
export async function groupMailsByRecipient(mails: ClassifiedMail[]): Promise<RecipientGroup[]> {
  const [personas, adminMembers] = await Promise.all([listPersonas(), listAdminTeamMembers()]);
  const groups = new Map<string, RecipientGroup>();

  function addTo(email: string, recipientName: string, team: "investment" | "admin", mail: ClassifiedMail) {
    const existing = groups.get(email);
    if (existing) {
      existing.mails.push(mail);
    } else {
      groups.set(email, { email, recipientName, team, mails: [mail] });
    }
  }

  for (const mail of mails) {
    if (mail.category === "ir") {
      const reviewers = personas.filter((p) => p.email && !p.isDefault);
      for (const p of reviewers) addTo(p.email!, p.name, "investment", mail);
      // 등록된 심사역이 한 명도 없으면 조용히 버리지 말고 관리팀이 받게 함
      if (reviewers.length === 0) {
        for (const member of adminMembers) addTo(member.email, member.name, "admin", mail);
      }
    } else if (mail.category === "invest_other") {
      // 데모데이·LP/출자 참여 등 — 특정 영역이 없으니 이메일이 등록된 심사역 전원(투자팀)에게
      const reviewers = personas.filter((p) => p.email && !p.isDefault);
      for (const p of reviewers) addTo(p.email!, p.name, "investment", mail);
      if (reviewers.length === 0) {
        for (const member of adminMembers) addTo(member.email, member.name, "admin", mail);
      }
    } else if (teamOf(mail.category) === "admin") {
      for (const member of adminMembers) addTo(member.email, member.name, "admin", mail);
    }
  }

  return Array.from(groups.values());
}
