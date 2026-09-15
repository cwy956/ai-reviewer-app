import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/supabaseClient";
import { CATEGORY_LABELS, CATEGORY_ORDER, type MailCategory } from "@/lib/mail/classify";
import { getDomain } from "@/lib/domains";

export const runtime = "nodejs";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface ClassifiedMailRow {
  msg_num: number;
  subject: string;
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
      .select("msg_num, subject, category, domain_id, processed_at")
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

  // --- 요약 카드 ---
  const categoryCounts: Record<string, number> = {};
  for (const cat of CATEGORY_ORDER) categoryCounts[cat] = 0;
  let newIRThisWeek = 0;
  for (const m of mails) {
    categoryCounts[m.category] = (categoryCounts[m.category] ?? 0) + 1;
    if (m.category === "ir" && isWithin7d(m.processed_at)) newIRThisWeek++;
  }

  let sendSuccess7d = 0;
  let sendFailed7d = 0;
  for (const l of logs) {
    if (!isWithin7d(l.sent_at)) continue;
    if (l.status === "sent") sendSuccess7d++;
    else sendFailed7d++;
  }

  // --- 업종별 IR 분포 ---
  const domainCounts = new Map<string, number>();
  for (const m of mails) {
    if (m.category !== "ir" || !m.domain_id) continue;
    domainCounts.set(m.domain_id, (domainCounts.get(m.domain_id) ?? 0) + 1);
  }
  const domainDistribution = Array.from(domainCounts.entries())
    .map(([domainId, count]) => ({ domainId, label: getDomain(domainId)?.label ?? domainId, count }))
    .sort((a, b) => b.count - a.count);

  // --- 담당자 커버리지 갭 ---
  const nonDefaultPersonas = personas.filter((p) => !p.is_default);
  const coveredDomains = new Set<string>();
  for (const p of nonDefaultPersonas) {
    if (!p.email) continue;
    for (const c of p.domain_criteria ?? []) coveredDomains.add(c.domainId);
  }
  const uncoveredDomainIds = domainDistribution
    .map((d) => d.domainId)
    .filter((id) => !coveredDomains.has(id));
  const uncoveredDomains = uncoveredDomainIds.map((id) => ({
    domainId: id,
    label: getDomain(id)?.label ?? id,
    irCount: domainCounts.get(id) ?? 0,
  }));

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

  // --- 심사역별 현황 ---
  const reviewerTable = nonDefaultPersonas.map((p) => ({
    id: p.id,
    name: p.name,
    hasEmail: Boolean(p.email),
    domainCount: (p.domain_criteria ?? []).length,
    receivedCount: p.email ? logs.filter((l) => l.recipient_email === p.email && l.status === "sent").length : 0,
  }));

  // --- 최근 활동 피드 (분류 + 발송을 시간순으로 합침) ---
  type FeedItem =
    | { type: "classified"; at: string; msgNum: number; subject: string; category: string }
    | { type: "sent" | "failed"; at: string; msgNum: number; subject: string; recipientEmail: string };
  const feed: FeedItem[] = [
    ...mails.slice(0, 50).map(
      (m): FeedItem => ({ type: "classified", at: m.processed_at, msgNum: m.msg_num, subject: m.subject, category: m.category })
    ),
    ...logs.slice(0, 50).map(
      (l): FeedItem => ({
        type: l.status === "sent" ? "sent" : "failed",
        at: l.sent_at,
        msgNum: l.msg_num,
        subject: l.subject,
        recipientEmail: l.recipient_email,
      })
    ),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  return NextResponse.json({
    summary: {
      totalInMailbox: metaRes.data?.total_in_mailbox ?? null,
      classifiedCount: mails.length,
      newIRThisWeek,
      sendSuccess7d,
      sendFailed7d,
      lastCheckedAt: watchRes.data?.last_checked_at ?? null,
      lastAlertedAt: watchRes.data?.last_alerted_at ?? null,
    },
    gaps: {
      uncoveredDomains,
      personasWithoutEmail,
      recentFailed,
    },
    categoryDistribution: CATEGORY_ORDER.map((cat) => ({ category: cat, label: CATEGORY_LABELS[cat], count: categoryCounts[cat] ?? 0 })),
    domainDistribution,
    reviewerTable,
    feed,
  });
}
