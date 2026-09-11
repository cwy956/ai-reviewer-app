import fs from "fs";
import path from "path";
import type { ClassifiedMail } from "./classify";
import type { MailSummary } from "./client";

const CACHE_PATH = path.join(process.cwd(), "lib", "mail", "backlog-cache.json");
const PENDING_PATH = path.join(process.cwd(), "lib", "mail", "backlog-pending.json");

export interface BacklogCache {
  processedAt: string;
  totalInMailbox: number;
  mails: ClassifiedMail[];
}

export function readBacklogCache(): BacklogCache | null {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf-8");
    return JSON.parse(raw) as BacklogCache;
  } catch {
    return null;
  }
}

export function writeBacklogCache(cache: BacklogCache): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf-8");
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

export function writePendingJob(job: PendingBacklogJob): void {
  fs.writeFileSync(PENDING_PATH, JSON.stringify(job, null, 2) + "\n", "utf-8");
}

export function readPendingJob(): PendingBacklogJob | null {
  try {
    const raw = fs.readFileSync(PENDING_PATH, "utf-8");
    return JSON.parse(raw) as PendingBacklogJob;
  } catch {
    return null;
  }
}

export function clearPendingJob(): void {
  try {
    fs.unlinkSync(PENDING_PATH);
  } catch {
    // nothing to clear
  }
}
