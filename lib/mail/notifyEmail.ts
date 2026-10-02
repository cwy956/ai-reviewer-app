import type { ClassifiedMail } from "./classify";
import { isInternalSender } from "./classify";
import { groupMailsByRecipient } from "./routing";
import { sendEmail } from "./sendEmail";
import { appendSendLog, type SendLogEntry } from "./sendLogStore";
import { fetchMessageForForwarding, fetchAttachmentContent } from "./client";

interface FullMailForForwarding {
  text: string;
  html: string | null;
  attachments: { filename: string; content: Buffer }[];
}

/**
 * Strips `target="_blank"` and inline `on*` event handlers (e.g. `onclick="window.open(...)"`)
 * from forwarded HTML. Real-world case that forced this: a Daum "대용량첨부" download button
 * opens via `window.open(...)`, which browsers/ad-blockers classify as a *popup* request —
 * uBlock Origin's EasyPrivacy list blanket-blocks popups to `attach.mail.daum.net`, so the
 * button silently did nothing for anyone running an ad-blocker. Removing the popup trigger
 * leaves the plain `href` intact, so the same click just navigates normally instead — a type of
 * request generic blocklists don't block, since blocking normal navigation would break the web.
 * Other webmail providers (Naver, Gmail, etc.) use similar JS-popup download buttons, so this is
 * applied to every forwarded mail, not special-cased to Daum.
 */
function neutralizePopupLinks(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"(?:[^"\\]|\\.)*"/gi, "")
    .replace(/\son\w+\s*=\s*'(?:[^'\\]|\\.)*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/\starget\s*=\s*"_blank"/gi, "")
    .replace(/\starget\s*=\s*'_blank'/gi, "");
}

/** Fetches one mail's full body (text + original HTML, when it has one) + every attachment's
 * actual bytes, for forwarding verbatim in the alert email — now that alerts go out per-mail
 * (threshold=1), the recipient should see the real thing, not a one-line summary + dashboard
 * link. Keeping the HTML matters: many "attachments" are really a download-link button that only
 * exists in the HTML part (e.g. Daum's large-file links) — a plain-text-only forward would make
 * that link invisible/unusable. */
async function fetchFullMailForForwarding(msgNum: number): Promise<FullMailForForwarding> {
  const full = await fetchMessageForForwarding(msgNum);
  const attachments: { filename: string; content: Buffer }[] = [];
  for (const a of full.attachments) {
    try {
      const fetched = await fetchAttachmentContent(msgNum, a.index);
      attachments.push({ filename: fetched.filename, content: fetched.content });
    } catch (err) {
      console.error(`[notify] 메일 #${msgNum} 첨부파일 #${a.index}(${a.filename}) 조회 실패, 건너뜀:`, err);
    }
  }
  return { text: full.text, html: full.html ? neutralizePopupLinks(full.html) : null, attachments };
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Builds an HTML alternative only when at least one mail in the batch actually has an HTML
 * part — otherwise returns null and the plain-text body is used alone. Mail without HTML falls
 * back to its plain text, preformatted, inside the same layout. */
function buildEmailHtml(
  mails: ClassifiedMail[],
  fullByMsgNum: Map<number, FullMailForForwarding>,
  dashboardUrl?: string
): string | null {
  if (!mails.some((m) => fullByMsgNum.get(m.msgNum)?.html)) return null;

  const sections = mails.map((m, i) => {
    const full = fullByMsgNum.get(m.msgNum);
    const bodyHtml =
      full?.html ||
      `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(full?.text?.trim() || m.snippet || "(본문을 불러오지 못했습니다)")}</pre>`;
    return `
      <div style="margin:0 0 24px;padding:0 0 24px;border-bottom:1px solid #ddd;">
        <p style="font-weight:bold;margin:0 0 4px;">[${i + 1}] ${escapeHtml(m.subject)}</p>
        <p style="color:#666;font-size:13px;margin:0 0 16px;">발신: ${escapeHtml(m.from)}</p>
        <div>${bodyHtml}</div>
      </div>`;
  });

  const link = dashboardUrl
    ? `<p><a href="${dashboardUrl}">대시보드에서 전체 보기</a></p>`
    : "";

  return `<div style="font-family:sans-serif;font-size:14px;color:#111;max-width:680px;">
    <p>공용 메일함(andaasiavc@andaasiavc.com)에 담당하시는 영역의 새 메일이 도착했습니다.</p>
    ${sections.join("")}
    ${link}
    <p style="color:#999;font-size:12px;">(이 메일은 ANDA 페르소나가 자동으로 분류·발송한 알림입니다.)</p>
  </div>`;
}

export interface EmailAlertResult {
  sentGroups: number;
  failedGroups: number;
  skippedNoRecipient: number;
}

/**
 * Sends one email per recipient (reviewer persona or admin team), grouping every mail routed
 * to them into a single message — forwarding each mail's full content (HTML when available,
 * so download-link buttons stay clickable) and attachments verbatim — and logs each mail's send
 * outcome for the "발송 여부" dashboard. Internal-domain senders are dropped before routing.
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
      group.team === "investment" ? `투자팀 - ${group.recipientName}` : `관리팀 - ${group.recipientName}`;
    const attachments = group.mails.flatMap((m) => fullByMsgNum.get(m.msgNum)?.attachments ?? []);
    const result = await sendEmail({
      to: group.email,
      subject: `[ANDA 페르소나] 새 메일 ${group.mails.length}통 도착 — ${subjectLabel}`,
      text: buildEmailBody(group.mails, fullByMsgNum, dashboardUrl),
      html: buildEmailHtml(group.mails, fullByMsgNum, dashboardUrl) ?? undefined,
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
