import nodemailer from "nodemailer";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Lazily builds (and reuses) the SMTP transporter for the shared company mailbox. */
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.MAIL_SMTP_HOST || "smtp.whoisworks.com";
  const port = Number(process.env.MAIL_SMTP_PORT || 587);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;
  if (!user || !pass) {
    throw new Error("메일 발신 계정(MAIL_USER/MAIL_PASSWORD)이 .env.local에 설정되어 있지 않습니다.");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // port 587 uses STARTTLS, not implicit TLS
    requireTLS: true,
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
    return { ok: false, error: err instanceof Error ? err.message : "알 수 없는 발송 오류" };
  }
}
