import { getSupabase } from "../db/supabaseClient";
import type { ClassifiedMail } from "./classify";
import type { MailSummary } from "./client";

export interface BacklogCache {
  processedAt: string;
  totalInMailbox: number;
  mails: ClassifiedMail[];
}

function mailToRow(m: ClassifiedMail) {
  return {
    msg_num: m.msgNum,
    subject: m.subject,
    from_address: m.from,
    mail_date: m.date || null,
    has_attachment: m.hasAttachment,
    snippet: m.snippet,
    category: m.category,
    reason: m.reason,
    priority: m.priority,
    domain_id: m.domainId,
  };
}

function rowToMail(row: Record<string, unknown>): ClassifiedMail {
  return {
    msgNum: row.msg_num as number,
    subject: row.subject as string,
    from: row.from_address as string,
    date: (row.mail_date as string) ?? "",
    hasAttachment: row.has_attachment as boolean,
    snippet: (row.snippet as string) ?? "",
    category: row.category as ClassifiedMail["category"],
    reason: (row.reason as string) ?? "",
    priority: row.priority as ClassifiedMail["priority"],
    domainId: (row.domain_id as string | null) ?? null,
  };
}

/** Reads the classified backlog — metadata (when/how many) plus every classified mail on file
 * (this table is shared with the live/watch classification path, so it reflects the latest
 * known classification for every message, not just the last full backlog run). */
export async function readBacklogCache(): Promise<BacklogCache | null> {
  const supabase = getSupabase();
  const { data: meta, error: metaError } = await supabase
    .from("mail_backlog_meta")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (metaError) throw new Error(`백로그 메타데이터 조회 실패: ${metaError.message}`);
  if (!meta) return null;

  const { data: mailRows, error: mailsError } = await supabase
    .from("classified_mails")
    .select("*")
    .order("msg_num", { ascending: false });
  if (mailsError) throw new Error(`백로그 메일 조회 실패: ${mailsError.message}`);

  return {
    processedAt: meta.processed_at,
    totalInMailbox: meta.total_in_mailbox,
    mails: (mailRows ?? []).map(rowToMail),
  };
}

/** Upserts every classified mail (by msg_num) and records when this batch finished. */
export async function writeBacklogCache(cache: BacklogCache): Promise<void> {
  const supabase = getSupabase();

  const { error: metaError } = await supabase
    .from("mail_backlog_meta")
    .upsert(
      { id: 1, processed_at: cache.processedAt, total_in_mailbox: cache.totalInMailbox },
      { onConflict: "id" }
    );
  if (metaError) throw new Error(`백로그 메타데이터 저장 실패: ${metaError.message}`);

  if (cache.mails.length === 0) return;
  const rows = cache.mails.map(mailToRow);
  // Supabase/PostgREST caps request size — chunk large backlogs (e.g. 1,400+ mails) to be safe.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("classified_mails").upsert(rows.slice(i, i + CHUNK), { onConflict: "msg_num" });
    if (error) throw new Error(`백로그 메일 저장 실패: ${error.message}`);
  }
}

/**
 * A batch job that's been submitted to the Anthropic Batches API but not yet finalized.
 * The original (unclassified) mail summaries are stashed here so a later step — which
 * doesn't need POP3 access at all — can re-merge classification results onto them once
 * the batch finishes, without re-fetching the mailbox.
 */
export interface PendingBacklogJob {
  batchId: string;
  submittedAt: string;
  totalInMailbox: number;
  mails: MailSummary[];
}

export async function writePendingJob(job: PendingBacklogJob): Promise<void> {
  const { error } = await getSupabase()
    .from("mail_backlog_pending")
    .upsert(
      {
        id: 1,
        batch_id: job.batchId,
        submitted_at: job.submittedAt,
        total_in_mailbox: job.totalInMailbox,
        mails: job.mails,
      },
      { onConflict: "id" }
    );
  if (error) throw new Error(`백로그 작업 상태 저장 실패: ${error.message}`);
}

export async function readPendingJob(): Promise<PendingBacklogJob | null> {
  const { data, error } = await getSupabase().from("mail_backlog_pending").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`백로그 작업 상태 조회 실패: ${error.message}`);
  if (!data) return null;
  return {
    batchId: data.batch_id,
    submittedAt: data.submitted_at,
    totalInMailbox: data.total_in_mailbox,
    mails: data.mails,
  };
}

export async function clearPendingJob(): Promise<void> {
  const { error } = await getSupabase().from("mail_backlog_pending").delete().eq("id", 1);
  if (error) throw new Error(`백로그 작업 상태 삭제 실패: ${error.message}`);
}
