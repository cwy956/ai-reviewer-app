import { countMessages, fetchRecentMailSummaries } from "./client";
import { classifyMails, type ClassifiedMail } from "./classify";
import { sendEmailAlerts } from "./notifyEmail";
import { readWatchState, writeWatchState } from "./watchStore";
import { autoEvaluateIrMails } from "./autoEvaluate";
import { upsertClassifiedMails } from "./backlogStore";

// 메일 유입량이 적은(며칠에 1통꼴) 지금 상황에서 5통 기준은 몇 주씩 알림이 안 갈 수 있어서
// 1통으로 낮춤 — 유입량이 적으니 스팸 걱정도 없음. 유입량이 늘면 다시 올릴 수 있음.
const THRESHOLD = Number(process.env.MAIL_WATCH_THRESHOLD || 1);

/** Fans a classified batch out to reviewers/admin by email and logs the outcome. */
async function dispatchAlerts(classified: ClassifiedMail[], label: string) {

  const email = await sendEmailAlerts(classified);

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
    // 분류 결과를 영구 저장 — 이게 없으면 알림만 보내고 끝나서, 이 메일은 /ir-deals에 영영
    // 나타나지 않음(백로그 때는 이 저장이 있었지만 실시간 감시 경로엔 빠져 있었음).
    await upsertClassifiedMails(classified);
    await dispatchAlerts(classified, "");
    await writeWatchState({ lastAlertedCount: total, lastCheckedAt: new Date().toISOString(), lastAlertedAt: new Date().toISOString() });

    // Runs only after the alert + watch-state write above are safely committed, so a slow/failed
    // auto-evaluation (or the function getting killed by its own time limit mid-way through) can
    // never cause mail to be re-classified/re-alerted on the next check — worst case, an
    // unevaluated IR mail just sits in /ir-deals waiting for a manual "평가하기" click.
    await autoEvaluateIrMails(classified).catch((err) => {
      console.error("[mail-watch] IR 자동 평가 중 오류(알림 자체는 이미 정상 발송됨):", err);
    });

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
