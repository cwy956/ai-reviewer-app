import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/supabaseClient";
import { CATEGORY_LABELS, teamOf, type MailCategory } from "@/lib/mail/classify";

export const runtime = "nodejs";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 100;

interface ClassifiedMailRow {
  msg_num: number;
  subject: string;
  from_address: string;
  mail_date: string | null;
  category: MailCategory;
  processed_at: string;
}

interface SendLogRow {
  msg_num: number;
  recipient_email: string;
  recipient_name: string | null;
  sent_at: string;
  status: "sent" | "failed";
}

export async function GET() {
  const supabase = getSupabase();

  const [watchRes, mailsRes, logRes] = await Promise.all([
    supabase.from("mail_watch_state").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("classified_mails")
      .select("msg_num, subject, from_address, mail_date, category, processed_at")
      .order("msg_num", { ascending: false })
      .limit(5000),
    supabase
      .from("mail_send_log")
      .select("msg_num, recipient_email, recipient_name, sent_at, status")
      .order("sent_at", { ascending: false })
      .limit(2000),
  ]);

  for (const [label, res] of [
    ["watch state", watchRes],
    ["classified mails", mailsRes],
    ["send log", logRes],
  ] as const) {
    if (res.error) return NextResponse.json({ error: `${label} 조회 실패: ${res.error.message}` }, { status: 500 });
  }

  const mails = (mailsRes.data ?? []) as ClassifiedMailRow[];
  const logs = (logRes.data ?? []) as SendLogRow[];

  const now = Date.now();
  const isWithin7d = (iso: string) => now - new Date(iso).getTime() <= SEVEN_DAYS_MS;

  // 받은 날짜 기준 — processed_at은 백로그 일괄처리 시각이라 "이번 주"가 왜곡됨
  let newIRThisWeek = 0;
  let investmentThisWeek = 0;
  let adminThisWeek = 0;
  for (const m of mails) {
    if (!isWithin7d(m.mail_date ?? m.processed_at)) continue;
    if (m.category === "ir") newIRThisWeek++;
    const team = teamOf(m.category);
    if (team === "investment") investmentThisWeek++;
    else if (team === "admin") adminThisWeek++;
  }

  let sendFailed7d = 0;
  for (const l of logs) {
    if (isWithin7d(l.sent_at) && l.status === "failed") sendFailed7d++;
  }

  // 이메일 수신 이력: 받은 메일 + 누구에게 전달됐는지
  const deliveriesByMsg = new Map<number, { name: string; status: "sent" | "failed" }[]>();
  for (const l of logs) {
    const name = l.recipient_name ?? l.recipient_email;
    const list = deliveriesByMsg.get(l.msg_num) ?? [];
    if (!list.some((d) => d.name === name)) list.push({ name, status: l.status });
    deliveriesByMsg.set(l.msg_num, list);
  }

  const mailHistory = [...mails]
    .sort((a, b) => new Date(b.mail_date ?? b.processed_at).getTime() - new Date(a.mail_date ?? a.processed_at).getTime())
    .slice(0, HISTORY_LIMIT)
    .map((m) => ({
      msgNum: m.msg_num,
      subject: m.subject,
      from: m.from_address,
      receivedAt: m.mail_date ?? m.processed_at,
      team: teamOf(m.category),
      categoryLabel: CATEGORY_LABELS[m.category] ?? m.category,
      deliveries: deliveriesByMsg.get(m.msg_num) ?? [],
    }));

  return NextResponse.json({
    summary: {
      newIRThisWeek,
      investmentThisWeek,
      adminThisWeek,
      sendFailed7d,
      lastCheckedAt: watchRes.data?.last_checked_at ?? null,
    },
    mailHistory,
  });
}
