import type { ClassifiedMail } from "./classify";
import { isInternalSender } from "./classify";
import { groupMailsByRecipient } from "./routing";
import { sendEmail } from "./sendEmail";
import { appendSendLog, type SendLogEntry } from "./sendLogStore";
import { fetchMessageForForwarding, fetchAttachmentContent } from "./client";
import { dealLink, homeLink } from "../appUrl";
import { markPasswordSent, passwordForFirstAlert } from "./accessPassword";
import { ALERT_FOOTER_TEXT, escapeHtml, layoutHtml, platformButtonHtml, platformLinkText } from "./alertLayout";

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

/** 메일 한 통에서 관리자 플랫폼으로 가는 링크 — IR 메일은 해당 딜 팝업이 바로 열리고, 그 외는 홈(수신 이력)으로 */
function linkFor(m: ClassifiedMail): string {
  return m.category === "ir" ? dealLink(`mail-${m.msgNum}`) : homeLink();
}

function buildEmailBody(mails: ClassifiedMail[], fullByMsgNum: Map<number, FullMailForForwarding>, pw: string | null): string {
  const sections = mails.map((m, i) => {
    const full = fullByMsgNum.get(m.msgNum);
    const body = full?.text?.trim() || m.snippet || "(본문을 불러오지 못했습니다)";
    return `[${i + 1}] ${m.subject}\n발신: ${m.from}\n\n${body}\n\n${platformLinkText(linkFor(m), "관리자 플랫폼에서 보기")}`;
  });
  return `공용 메일함에 새 메일이 도착했어요.\n\n${sections.join("\n\n─────────\n\n")}\n\n${platformLinkText(homeLink(), undefined, pw)}\n\n(${ALERT_FOOTER_TEXT})`;
}

/** 링크 버튼을 항상 클릭 가능하게 보여주려고 HTML 본문은 항상 만듦 — 원본에 HTML이 없는 메일은 일반 텍스트를 그대로 넣음. */
function buildEmailHtml(mails: ClassifiedMail[], fullByMsgNum: Map<number, FullMailForForwarding>, pw: string | null): string {
  const sections = mails.map((m, i) => {
    const full = fullByMsgNum.get(m.msgNum);
    const bodyHtml =
      full?.html ||
      `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(full?.text?.trim() || m.snippet || "(본문을 불러오지 못했습니다)")}</pre>`;
    return `
      <div style="margin:0 0 24px;padding:0 0 24px;border-bottom:1px solid #ddd;">
        <p style="font-weight:bold;margin:0 0 4px;">[${i + 1}] ${escapeHtml(m.subject)}</p>
        <p style="color:#666;font-size:13px;margin:0 0 4px;">발신: ${escapeHtml(m.from)}</p>
        <p style="margin:0 0 16px;font-size:13px;"><a href="${escapeHtml(linkFor(m))}" style="color:#304b2a;">관리자 플랫폼에서 보기 →</a></p>
        <div>${bodyHtml}</div>
      </div>`;
  });

  return layoutHtml(`
    <p>공용 메일함에 새 메일이 도착했어요.</p>
    ${platformButtonHtml(homeLink(), undefined, pw)}
    ${sections.join("")}
    ${platformButtonHtml(homeLink())}`);
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
export async function sendEmailAlerts(rawMails: ClassifiedMail[]): Promise<EmailAlertResult> {
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
    const attachments = group.mails.flatMap((m) => fullByMsgNum.get(m.msgNum)?.attachments ?? []);
    // 접속 비밀번호는 이 사람이 처음 받는 알림에만 넣음
    const pw = await passwordForFirstAlert(group.email);
    const result = await sendEmail({
      to: group.email,
      // 받는 팀을 앞에 두면 메일함에서 한눈에 구분됨 — 투자팀·관리팀 공통 형식
      subject: `[${group.team === "investment" ? "투자팀" : "관리팀"}] 새 메일 ${group.mails.length}통 도착`,
      text: buildEmailBody(group.mails, fullByMsgNum, pw),
      html: buildEmailHtml(group.mails, fullByMsgNum, pw),
      team: group.team,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    if (result.ok) {
      sentGroups++;
      if (pw) await markPasswordSent(group.email);
    } else failedGroups++;

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
