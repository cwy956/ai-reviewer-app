// Sends via the Resend HTTPS API (https://resend.com) instead of raw SMTP — Railway (and many
// PaaS hosts) block outbound SMTP ports entirely to prevent spam abuse, which made the earlier
// nodemailer/smtp.whoisworks.com approach fail with ETIMEDOUT regardless of port. Resend only
// needs outbound HTTPS (443), which is never blocked.

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  /** Rendered HTML alternative — most clients prefer this over `text` when both are present. */
  html?: string;
  attachments?: { filename: string; content: Buffer }[];
  /** 받는 팀 — 보내는 사람 표시 이름이 팀별로 달라짐(투자팀/관리팀). */
  team?: "investment" | "admin";
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

const TEAM_NAME = { investment: "안다아시아벤처스 투자팀", admin: "안다아시아벤처스 관리팀" } as const;

/**
 * 보내는 사람 결정.
 * 1) 팀 전용 환경변수(RESEND_FROM_INVESTMENT / RESEND_FROM_ADMIN)가 있으면 그대로 사용 — 팀마다 다른 "주소"를 쓰고 싶을 때
 *    (Resend에서 도메인 인증을 마친 뒤에만 가능)
 * 2) 없으면 RESEND_FROM_EMAIL의 "주소" 부분만 가져와 "표시 이름"을 팀 이름으로 붙임
 *    → Vercel에는 주소 하나(RESEND_FROM_EMAIL)만 있어도 투자팀/관리팀 이름이 따로 나감.
 */
function resolveFrom(team?: "investment" | "admin"): string {
  if (team === "investment" && process.env.RESEND_FROM_INVESTMENT) return process.env.RESEND_FROM_INVESTMENT;
  if (team === "admin" && process.env.RESEND_FROM_ADMIN) return process.env.RESEND_FROM_ADMIN;

  const configured = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  const address = /<([^>]+)>/.exec(configured)?.[1] ?? configured;
  const displayName = team ? TEAM_NAME[team] : "안다아시아벤처스";
  return `${displayName} <${address}>`;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY가 설정되어 있지 않습니다." };
  }
  // Without a verified sending domain in Resend, only their shared onboarding@resend.dev sender
  // works — it can send to any recipient, so it's a fine default until a real domain is verified.
  const from = resolveFrom(params.team);

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString("base64"),
        })),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "알 수 없는 발송 오류" };
  }
}
