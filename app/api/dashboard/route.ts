import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/supabaseClient";
import { CATEGORY_LABELS, teamOf, type MailCategory } from "@/lib/mail/classify";
import { getDomain } from "@/lib/domains";

export const runtime = "nodejs";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 100;

interface ClassifiedMailRow {
  msg_num: number;
  subject: string;
  from_address: string;
  mail_date: string | null;
  category: MailCategory;
  domain_id: string | null;
  processed_at: string;
}

interface SendLogRow {
  id: number;
  msg_num: number;
  subject: string;
  category: string;
  domain_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  sent_at: string;
  status: "sent" | "failed";
  error: string | null;
}

interface PersonaRow {
  id: string;
  name: string;
  email: string | null;
  is_default: boolean;
  domain_criteria: { domainId: string }[];
}

export async function GET() {
  const supabase = getSupabase();

  const [metaRes, watchRes, mailsRes, logRes, personasRes] = await Promise.all([
    supabase.from("mail_backlog_meta").select("*").eq("id", 1).maybeSingle(),
    supabase.from("mail_watch_state").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("classified_mails")
      .select("msg_num, subject, from_address, mail_date, category, domain_id, processed_at")
      .order("msg_num", { ascending: false })
      .limit(5000),
    supabase
      .from("mail_send_log")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(2000),
    supabase.from("personas").select("id, name, email, is_default, domain_criteria"),
  ]);

  for (const [label, res] of [
    ["backlog meta", metaRes],
    ["watch state", watchRes],
    ["classified mails", mailsRes],
    ["send log", logRes],
    ["personas", personasRes],
  ] as const) {
    if (res.error) return NextResponse.json({ error: `${label} 조회 실패: ${res.error.message}` }, { status: 500 });
  }

  const mails = (mailsRes.data ?? []) as ClassifiedMailRow[];
  const logs = (logRes.data ?? []) as SendLogRow[];
  const personas = (personasRes.data ?? []) as PersonaRow[];

  const now = Date.now();
  const isWithin7d = (iso: string) => now - new Date(iso).getTime() <= SEVEN_DAYS_MS;

  // --- 요약 카드 (받은 날짜 기준 — processed_at은 백로그 일괄처리 시각이라 "이번 주"가 왜곡됨) ---
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

  // --- 담당자 커버리지 갭 ---
  const domainCounts = new Map<string, number>();
  for (const m of mails) {
    if (m.category !== "ir" || !m.domain_id) continue;
    domainCounts.set(m.domain_id, (domainCounts.get(m.domain_id) ?? 0) + 1);
  }
  const nonDefaultPersonas = personas.filter((p) => !p.is_default);
  const coveredDomains = new Set<string>();
  for (const p of nonDefaultPersonas) {
    if (!p.email) continue;
    for (const c of p.domain_criteria ?? []) coveredDomains.add(c.domainId);
  }
  const uncoveredDomains = Array.from(domainCounts.keys())
    .filter((id) => !coveredDomains.has(id))
    .map((id) => ({ domainId: id, label: getDomain(id)?.label ?? id, irCount: domainCounts.get(id) ?? 0 }))
    .sort((a, b) => b.irCount - a.irCount);

  const personasWithoutEmail = nonDefaultPersonas
    .filter((p) => !p.email)
    .map((p) => ({ id: p.id, name: p.name }));

  const recentFailed = logs
    .filter((l) => l.status === "failed")
    .slice(0, 20)
    .map((l) => ({
      msgNum: l.msg_num,
      subject: l.subject,
      recipientEmail: l.recipient_email,
      sentAt: l.sent_at,
      error: l.error,
    }));

  // --- 이메일 수신 이력: 받은 메일 + 누구에게 전달됐는지 ---
  const deliveriesByMsg = new Map<number, { name: string; status: "sent" | "failed" }[]>();
  for (const l of logs) {
    const list = deliveriesByMsg.get(l.msg_num) ?? [];
    if (!list.some((d) => d.name === (l.recipient_name ?? l.recipient_email))) {
      list.push({ name: l.recipient_name ?? l.recipient_email, status: l.status });
    }
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
    gaps: {
      uncoveredDomains,
      personasWithoutEmail,
      recentFailed,
    },
    mailHistory,
  });
}
