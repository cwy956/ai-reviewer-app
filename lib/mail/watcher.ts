import { countMessages, fetchRecentMailSummaries } from "./client";
import { classifyMails, type ClassifiedMail } from "./classify";
import { sendEmailAlerts } from "./notifyEmail";
import { readWatchState, writeWatchState } from "./watchStore";

const THRESHOLD = Number(process.env.MAIL_WATCH_THRESHOLD || 5);

/** Fans a classified batch out to reviewers/admin by email and logs the outcome. */
async function dispatchAlerts(classified: ClassifiedMail[], label: string) {
  const appUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const dashboardUrl = `${appUrl}/mailbox`;

  const email = await sendEmailAlerts(classified, dashboardUrl);

  console.log(
    `[mail-watch]${label} 메일 ${classified.length}통 알림 — 이메일: ${email.sentGroups}명 성공, ` +
      `${email.failedGroups}명 실패, 담당자 없어 스킵 ${email.skippedNoRecipient}건`
  );

  return { email };
}

export interface WatchCheckResult {
  totalInMailbox: number;
  newSinceLastAlert: number;
  alerted: boolean;
}

/**
 * Polls the mailbox message count (cheap — one POP3 STAT command) and, once at least
 * THRESHOLD new messages have arrived since the last alert, fetches + classifies just that
 * new batch and emails the reviewers/admin who cover it. Never touches messages that were
 * already accounted for.
 */
export async function checkForNewMail(): Promise<WatchCheckResult> {
  const total = await countMessages();
  const state = await readWatchState();

  if (!state) {
    // First ever check: baseline to the current count so we only alert on mail that arrives
    // from here on, not the entire pre-existing backlog.
    await writeWatchState({ lastAlertedCount: total, lastCheckedAt: new Date().toISOString(), lastAlertedAt: null });
    return { totalInMailbox: total, newSinceLastAlert: 0, alerted: false };
  }

  const newSinceLastAlert = total - state.lastAlertedCount;

  // The mailbox count can drop (mail deleted/archived by someone, retention cleanup, etc.),
  // which would otherwise make this permanently negative and silently block all future alerts
  // until the count climbs back past the old baseline. Re-baseline instead of alerting on a
  // deletion, and start counting fresh from here.
  if (newSinceLastAlert < 0) {
    console.log(
      `[mail-watch] 메일함 통수가 줄어듦(${state.lastAlertedCount} → ${total}) — 기준점을 현재 통수로 재설정합니다.`
    );
    await writeWatchState({ lastAlertedCount: total, lastCheckedAt: new Date().toISOString(), lastAlertedAt: state.lastAlertedAt });
    return { totalInMailbox: total, newSinceLastAlert: 0, alerted: false };
  }

  if (newSinceLastAlert >= THRESHOLD) {
    const newMails = await fetchRecentMailSummaries(newSinceLastAlert);
    const classified = await classifyMails(newMails);
    await dispatchAlerts(classified, "");
    await writeWatchState({ lastAlertedCount: total, lastCheckedAt: new Date().toISOString(), lastAlertedAt: new Date().toISOString() });
    return { totalInMailbox: total, newSinceLastAlert, alerted: true };
  }

  await writeWatchState({ ...state, lastCheckedAt: new Date().toISOString() });
  return { totalInMailbox: total, newSinceLastAlert, alerted: false };
}

/**
 * Sends a real email alert for the newest `count` mails right now, bypassing the threshold
 * check — for manually testing the notification pipeline. Does NOT touch watch-state.json, so
 * it never disturbs the real "new mail since last alert" tracking.
 */
export async function sendTestAlert(count: number): Promise<{ fetchedCount: number; alerted: boolean }> {
  const mails = await fetchRecentMailSummaries(count);
  const classified = await classifyMails(mails);
  const { email } = await dispatchAlerts(classified, " (테스트)");
  return { fetchedCount: mails.length, alerted: email.sentGroups > 0 };
}
