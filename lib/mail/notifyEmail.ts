import type { ClassifiedMail } from "./classify";
import { isInternalSender } from "./classify";
import { groupMailsByRecipient } from "./routing";
import { sendEmail } from "./sendEmail";
import { appendSendLog, type SendLogEntry } from "./sendLogStore";
import { fetchFullMessage, fetchAttachmentContent } from "./client";

interface FullMailForForwarding {
  text: string;
  attachments: { filename: string; content: Buffer }[];
}

/** Fetches one mail's full body + every attachment's actual bytes, for forwarding verbatim in
 * the alert email — now that alerts go out per-mail (threshold=1), the recipient should see the
 * real thing, not a one-line summary + dashboard link. */
async function fetchFullMailForForwarding(msgNum: number): Promise<FullMailForForwarding> {
  const full = await fetchFullMessage(msgNum);
  const attachments: { filename: string; content: Buffer }[] = [];
  for (const a of full.attachments) {
    try {
      const fetched = await fetchAttachmentContent(msgNum, a.index);
      attachments.push({ filename: fetched.filename, content: fetched.content });
    } catch (err) {
      console.error(`[notify] 메일 #${msgNum} 첨부파일 #${a.index}(${a.filename}) 조회 실패, 건너뜀:`, err);
    }
  }
  return { text: full.text, attachments };
}

function buildEmailBody(
  mails: ClassifiedMail[],
  fullByMsgNum: Map<number, FullMailForForwarding>,
  dashboardUrl?: string
): string {
  const sections = mails.map((m, i) => {
    const full = fullByMsgNum.get(m.msgNum);
    const body = full?.text?.trim() || m.snippet || "(본문을 불러오지 못했습니다)";
    return `[${i + 1}] ${m.subject}\n발신: ${m.from}\n\n${body}`;
  });
  const link = dashboardUrl ? `\n\n대시보드에서 전체 보기: ${dashboardUrl}` : "";
  return `공용 메일함(andaasiavc@andaasiavc.com)에 담당하시는 영역의 새 메일이 도착했습니다.\n\n${sections.join("\n\n─────────\n\n")}${link}\n\n(이 메일은 ANDA 페르소나가 자동으로 분류·발송한 알림입니다.)`;
}

export interface EmailAlertResult {
  sentGroups: number;
  failedGroups: number;
  skippedNoRecipient: number;
}

/**
 * Sends one email per recipient (reviewer persona or admin team), grouping every mail routed
 * to them into a single message — forwarding each mail's full text and attachments verbatim
 * (not just a subject line) — and logs each mail's send outcome for the "발송 여부" dashboard.
 * Internal-domain senders are dropped before routing.
 */
export async function sendEmailAlerts(rawMails: ClassifiedMail[], dashboardUrl?: string): Promise<EmailAlertResult> {
  const mails = rawMails.filter((m) => !isInternalSender(m.from));
  const groups = await groupMailsByRecipient(mails);

  // Fetch each unique mail's full content once, even if it routes to several recipients
  // (e.g. multiple admin team members) — avoids redundant POP3 round-trips.
  const uniqueMsgNums = [...new Set(groups.flatMap((g) => g.mails.map((m) => m.msgNum)))];
  const fullByMsgNum = new Map<number, FullMailForForwarding>();
  for (const msgNum of uniqueMsgNums) {
    try {
      fullByMsgNum.set(msgNum, await fetchFullMailForForwarding(msgNum));
    } catch (err) {
      console.error(`[notify] 메일 #${msgNum} 원문 조회 실패, 스니펫만 전달:`, err);
    }
  }

  let sentGroups = 0;
  let failedGroups = 0;
  const logEntries: SendLogEntry[] = [];

  for (const group of groups) {
    const subjectLabel =
      group.team === "investment" ? `${group.recipientName} 심사역님 담당 영역` : `관리팀 - ${group.recipientName}`;
    const attachments = group.mails.flatMap((m) => fullByMsgNum.get(m.msgNum)?.attachments ?? []);
    const result = await sendEmail({
      to: group.email,
      subject: `[ANDA 페르소나] 새 메일 ${group.mails.length}통 도착 — ${subjectLabel}`,
      text: buildEmailBody(group.mails, fullByMsgNum, dashboardUrl),
      attachments: attachments.length > 0 ? attachments : undefined,
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
        recipientName: group.recipientName,
        sentAt: new Date().toISOString(),
        status: result.ok ? "sent" : "failed",
        error: result.error,
      });
    }
  }

  await appendSendLog(logEntries);

  // ir mail with a domainId but nobody covering it yet — not an error, just nothing to log a
  // recipient for; useful to surface as a count so gaps in reviewer coverage are visible.
  const routedMsgNums = new Set(groups.flatMap((g) => g.mails.map((m) => m.msgNum)));
  const skippedNoRecipient = mails.filter((m) => m.category !== "spam" && !routedMsgNums.has(m.msgNum)).length;

  return { sentGroups, failedGroups, skippedNoRecipient };
}
