import type { ClassifiedMail } from "./classify";
import { isInternalSender } from "./classify";
import { groupMailsByRecipient } from "./routing";
import { sendEmail } from "./sendEmail";
import { appendSendLog, type SendLogEntry } from "./sendLogStore";

function buildEmailBody(mails: ClassifiedMail[], dashboardUrl?: string): string {
  const lines = mails.map((m, i) => `${i + 1}. ${m.subject} — ${m.from}`);
  const link = dashboardUrl ? `\n\n대시보드에서 전체 보기: ${dashboardUrl}` : "";
  return `공용 메일함(andaasiavc@andaasiavc.com)에 담당하시는 영역의 새 메일이 도착했습니다.\n\n${lines.join("\n")}${link}\n\n(이 메일은 AI가 자동으로 분류·발송한 알림입니다.)`;
}

export interface EmailAlertResult {
  sentGroups: number;
  failedGroups: number;
  skippedNoRecipient: number;
}

/**
 * Sends one email per recipient (reviewer persona or admin team), grouping every mail routed
 * to them into a single message, and logs each mail's send outcome to send-log.json for the
 * "발송 여부" dashboard. Internal-domain senders are dropped before routing, same as the Teams path.
 */
export async function sendEmailAlerts(rawMails: ClassifiedMail[], dashboardUrl?: string): Promise<EmailAlertResult> {
  const mails = rawMails.filter((m) => !isInternalSender(m.from));
  const groups = groupMailsByRecipient(mails);

  let sentGroups = 0;
  let failedGroups = 0;
  const logEntries: SendLogEntry[] = [];

  for (const group of groups) {
    const subjectLabel = group.personaName ? `${group.personaName} 심사역님 담당 영역` : "관리팀";
    const result = await sendEmail({
      to: group.email,
      subject: `[AI 심사역] 새 메일 ${group.mails.length}통 도착 — ${subjectLabel}`,
      text: buildEmailBody(group.mails, dashboardUrl),
    });
    if (result.ok) sentGroups++;
    else failedGroups++;

    for (const mail of group.mails) {
      logEntries.push({
        msgNum: mail.msgNum,
        subject: mail.subject,
        category: mail.category,
        domainId: mail.domainId,
        recipientEmail: group.email,
        recipientName: group.personaName,
        sentAt: new Date().toISOString(),
        status: result.ok ? "sent" : "failed",
        error: result.error,
      });
    }
  }

  appendSendLog(logEntries);

  // ir mail with a domainId but nobody covering it yet — not an error, just nothing to log a
  // recipient for; useful to surface as a count so gaps in reviewer coverage are visible.
  const routedMsgNums = new Set(groups.flatMap((g) => g.mails.map((m) => m.msgNum)));
  const skippedNoRecipient = mails.filter((m) => m.category !== "spam" && !routedMsgNums.has(m.msgNum)).length;

  return { sentGroups, failedGroups, skippedNoRecipient };
}
