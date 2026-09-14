// Sends via the Resend HTTPS API (https://resend.com) instead of raw SMTP — Railway (and many
// PaaS hosts) block outbound SMTP ports entirely to prevent spam abuse, which made the earlier
// nodemailer/smtp.whoisworks.com approach fail with ETIMEDOUT regardless of port. Resend only
// needs outbound HTTPS (443), which is never blocked.

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY가 설정되어 있지 않습니다." };
  }
  // Without a verified sending domain in Resend, only their shared onboarding@resend.dev sender
  // works — it can send to any recipient, so it's a fine default until a real domain is verified.
  const from = process.env.RESEND_FROM_EMAIL || "AI 심사역 메일함 알림 <onboarding@resend.dev>";

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
