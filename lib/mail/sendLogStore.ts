import { getSupabase } from "../db/supabaseClient";

export interface SendLogEntry {
  msgNum: number;
  subject: string;
  category: string;
  domainId: string | null;
  recipientEmail: string;
  recipientName?: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
}

export async function readSendLog(): Promise<SendLogEntry[]> {
  const { data, error } = await getSupabase()
    .from("mail_send_log")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`발송 이력 조회 실패: ${error.message}`);

  return (data ?? []).map((row) => ({
    msgNum: row.msg_num,
    subject: row.subject,
    category: row.category,
    domainId: row.domain_id,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name ?? undefined,
    sentAt: row.sent_at,
    status: row.status,
    error: row.error ?? undefined,
  }));
}

export async function appendSendLog(entries: SendLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({
    msg_num: e.msgNum,
    subject: e.subject,
    category: e.category,
    domain_id: e.domainId,
    recipient_email: e.recipientEmail,
    recipient_name: e.recipientName ?? null,
    sent_at: e.sentAt,
    status: e.status,
    error: e.error ?? null,
  }));
  const { error } = await getSupabase().from("mail_send_log").insert(rows);
  if (error) throw new Error(`발송 이력 저장 실패: ${error.message}`);
}
