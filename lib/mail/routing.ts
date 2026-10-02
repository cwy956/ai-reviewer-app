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
 * - ir mails: every reviewer persona whose domainCriteria covers the mail's domainId AND has an
 *   email on file (set via onboarding) — a mail can go to more than one reviewer if several
 *   cover that domain, and falls back to the admin team if nobody does yet (new domains start uncovered).
 * - invest_other (데모데이·LP/출자 참여 등): every reviewer with an email — the investment team.
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
      if (!mail.domainId) continue;
      const covering = personas.filter(
        (p) => p.email && p.domainCriteria.some((c) => c.domainId === mail.domainId)
      );
      for (const p of covering) addTo(p.email!, p.name, "investment", mail);
      // 영역이 늘면서 담당자가 아직 없는 영역이 생길 수 있음 — 조용히 버리지 말고 관리팀이 받게 함
      if (covering.length === 0) {
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
