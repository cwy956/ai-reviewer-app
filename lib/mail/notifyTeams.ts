import { isInternalSender, type ClassifiedMail, type MailCategory } from "./classify";

export interface TeamsDigestParams {
  totalInMailbox: number;
  mails: ClassifiedMail[];
  dashboardUrl?: string;
}

export interface TeamsSendResult {
  ok: boolean;
  status?: number;
  error?: string;
  /** true when the corresponding webhook env var isn't set — not a failure, just unconfigured. */
  skipped?: boolean;
}

export interface TeamsDigestResult {
  reviewer: TeamsSendResult;
  admin: TeamsSendResult;
}

const ADMIN_CATEGORIES: MailCategory[] = ["gov_program", "biz_proposal", "etc"];

/** Drops mail sent from our own company domain — internal announcements (딜노트, 투심 공지 등)
 * that only hit the shared inbox because they were CC'd to a company-wide list. Never alert-worthy. */
function excludeInternal(mails: ClassifiedMail[]): ClassifiedMail[] {
  return mails.filter((m) => !isInternalSender(m.from));
}

/** Just the card title, a bare list of mail titles, and a dashboard link — no counts, no section headers. */
function buildCard(params: { title: string; lines: string[]; dashboardUrl?: string }) {
  const body: Record<string, unknown>[] = [{ type: "TextBlock", text: params.title, weight: "Bolder", size: "Medium" }];
  for (const line of params.lines) {
    body.push({ type: "TextBlock", text: line, wrap: true, spacing: "Small" });
  }
  if (params.dashboardUrl) {
    body.push({ type: "TextBlock", text: `[대시보드에서 전체 보기](${params.dashboardUrl})`, wrap: true, spacing: "Medium" });
  }
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body,
  };
}

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

/** Numbered, title-only lines (①②③…) — no sender address, no priority label (keep it terse). */
function numberedLines(mails: ClassifiedMail[]): string[] {
  return mails.map((m, i) => `${CIRCLED_NUMBERS[i] ?? `${i + 1}.`} ${m.subject}`);
}

async function postCard(webhookUrl: string | undefined, card: unknown): Promise<TeamsSendResult> {
  if (!webhookUrl) {
    return { ok: false, skipped: true, error: "웹훅 URL이 .env.local에 설정되어 있지 않습니다." };
  }
  const payload = {
    type: "message",
    attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: card }],
  };
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "알 수 없는 오류" };
  }
}

/**
 * Sends two separate digest cards via two separate Teams incoming webhooks:
 * - TEAMS_WEBHOOK_REVIEWER — IR·투자관련 메일만, 심사역 채널/채팅용
 * - TEAMS_WEBHOOK_ADMIN — 정부지원사업·협업제안·기타, 관리팀 채널/채팅용
 * Either (or both) can be left unconfigured — that leg is reported as skipped, not an error.
 * Internal-domain senders (사내 공지가 공용 메일함에 겹쳐 들어온 경우) are dropped before listing.
 * No counts are shown anywhere — just titles.
 */
export async function sendTeamsBacklogDigest(params: TeamsDigestParams): Promise<TeamsDigestResult> {
  const { dashboardUrl } = params;
  const mails = excludeInternal(params.mails);

  const irMails = mails.filter((m) => m.category === "ir");
  const irHigh = irMails.filter((m) => m.priority === "높음");

  const reviewerCard = buildCard({
    title: "📬 심사역용 — IR·투자 메일",
    // Priority is still used to pick which ones to surface, just not shown as a label — a full
    // backlog can have hundreds of IR mails, so we still need some signal to pick the top ones.
    lines: numberedLines((irHigh.length > 0 ? irHigh : irMails).slice(0, 8)),
    dashboardUrl,
  });

  const adminCard = buildCard({
    title: "📋 관리팀용 — 행정·제안 메일",
    lines: numberedLines(mails.filter((m) => m.category === "gov_program").slice(0, 5)),
    dashboardUrl,
  });

  const [reviewer, admin] = await Promise.all([
    postCard(process.env.TEAMS_WEBHOOK_REVIEWER, reviewerCard),
    postCard(process.env.TEAMS_WEBHOOK_ADMIN, adminCard),
  ]);

  return { reviewer, admin };
}

/**
 * Sends a lightweight "새 메일 도착" alert for a just-arrived batch (used by the mail watcher
 * once unclassified new mail crosses the alert threshold). Skips a leg entirely (no card sent)
 * when that audience has zero relevant mails after internal-sender filtering.
 */
export async function sendTeamsNewMailAlert(rawMails: ClassifiedMail[], dashboardUrl?: string): Promise<TeamsDigestResult> {
  const mails = excludeInternal(rawMails);
  const irMails = mails.filter((m) => m.category === "ir");
  const adminMails = mails.filter((m) => ADMIN_CATEGORIES.includes(m.category));

  const skip: TeamsSendResult = { ok: false, skipped: true, error: "이번 배치에 해당 카테고리 메일 없음(또는 전부 사내 공지)" };

  const reviewer =
    irMails.length === 0
      ? skip
      : await postCard(
          process.env.TEAMS_WEBHOOK_REVIEWER,
          buildCard({ title: "🔔 새 IR·투자 메일 도착", lines: numberedLines(irMails.slice(0, 8)), dashboardUrl })
        );

  const admin =
    adminMails.length === 0
      ? skip
      : await postCard(
          process.env.TEAMS_WEBHOOK_ADMIN,
          buildCard({ title: "🔔 새 행정·제안 메일 도착", lines: numberedLines(adminMails.slice(0, 8)), dashboardUrl })
        );

  return { reviewer, admin };
}
