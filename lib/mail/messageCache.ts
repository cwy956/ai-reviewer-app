import { getSupabase } from "../db/supabaseClient";
import type { FullMailContent } from "./client";

const BUCKET = "mail-cache";
let bucketEnsured = false;

/** Creates the storage bucket on first use — idempotent, so every cold start can safely call this
 * without needing a one-time manual setup step. */
async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const { error } = await getSupabase().storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) {
    console.error("[mail-cache] 버킷 생성 실패 (캐시 없이 계속 진행):", error.message);
  }
  bucketEnsured = true;
}

/**
 * Shared, durable cache for a POP3-fetched message (body text + the first PDF attachment's
 * bytes) — a message's content never changes once it's arrived, so this never needs a TTL or
 * invalidation. Without this, each user's browser only cached what *they* had already opened
 * (plain in-memory React state); the first time ANYONE on the team opened a given deal, they paid
 * the full POP3 RETR cost again even if a teammate had opened the exact same deal minutes earlier.
 * Caching is strictly best-effort: every failure here is caught and swallowed so callers always
 * have a working POP3 fallback.
 */
export async function getCachedMessage(msgNum: number): Promise<FullMailContent | null> {
  try {
    await ensureBucket();
    const { data, error } = await getSupabase().storage.from(BUCKET).download(`${msgNum}.json`);
    if (error || !data) return null;
    return JSON.parse(await data.text()) as FullMailContent;
  } catch (err) {
    console.error(`[mail-cache] 메일 #${msgNum} 캐시 조회 실패 (POP3로 폴백):`, err);
    return null;
  }
}

export async function setCachedMessage(msgNum: number, content: FullMailContent): Promise<void> {
  try {
    await ensureBucket();
    const blob = new Blob([JSON.stringify(content)], { type: "application/json" });
    const { error } = await getSupabase()
      .storage.from(BUCKET)
      .upload(`${msgNum}.json`, blob, { contentType: "application/json", upsert: true });
    if (error) console.error(`[mail-cache] 메일 #${msgNum} 캐시 저장 실패:`, error.message);
  } catch (err) {
    console.error(`[mail-cache] 메일 #${msgNum} 캐시 저장 중 오류:`, err);
  }
}
