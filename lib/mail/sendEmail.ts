import nodemailer from "nodemailer";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

/**
 * Lazily builds (and reuses) the SMTP transporter for the shared company mailbox.
 * secure/STARTTLS mode is derived from the port: 465 = implicit TLS, anything else = STARTTLS
 * (587 is the usual submission port). Some hosting platforms block outbound 587 but allow 465
 * (or vice versa) — set MAIL_SMTP_PORT=465 to switch if one is blocked.
 */
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.MAIL_SMTP_HOST || "smtp.whoisworks.com";
  const port = Number(process.env.MAIL_SMTP_PORT || 587);
  const secure = port === 465;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;
  if (!user || !pass) {
    throw new Error("메일 발신 계정(MAIL_USER/MAIL_PASSWORD)이 .env.local에 설정되어 있지 않습니다.");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 20_000,
    auth: { user, pass },
  });
  return cachedTransporter;
}

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
  try {
    const transporter = getTransporter();
    const from = process.env.MAIL_USER;
    await transporter.sendMail({
      from: `"AI 심사역 메일함 알림" <${from}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    const message = err instanceof Error ? err.message : "알 수 없는 발송 오류";
    return { ok: false, error: code ? `${message} (${code})` : message };
  }
}
