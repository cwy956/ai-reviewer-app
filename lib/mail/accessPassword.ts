import { createHash } from "crypto";
import { getSupabase } from "../db/supabaseClient";

// 알림 메일에 넣는 관리자 플랫폼 접속 비밀번호 — 받는 사람마다 "처음 받는 알림"에만 넣고, 이후 알림에는 넣지 않음.
// 이미 보냈는지는 Supabase Storage의 비공개 버킷에 받는 사람별 빈 파일로 기록(이메일 원문이 아니라 해시만 저장).
// 새 테이블이 필요 없고, 서버가 여러 개 뜨거나 재시작해도 유지됨.

const BUCKET = "alert-state";
let bucketReady = false;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const { error } = await getSupabase().storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw new Error(`알림 상태 저장소 준비 실패: ${error.message}`);
  bucketReady = true;
}

const keyFor = (email: string) => `pw-sent/${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24)}`;

/**
 * 이 사람에게 보낼 알림에 비밀번호를 넣어야 하면 비밀번호를, 아니면 null.
 * 환경변수가 없거나, 이미 한 번 보냈거나, 기록을 확인하지 못하면 null — 확인이 안 될 때는 안전하게 넣지 않음.
 */
export async function passwordForFirstAlert(email: string): Promise<string | null> {
  const password = process.env.INTERNAL_ACCESS_PASSWORD?.trim();
  if (!password) return null;
  try {
    await ensureBucket();
    const key = keyFor(email);
    const slash = key.lastIndexOf("/");
    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .list(key.slice(0, slash), { search: key.slice(slash + 1), limit: 5 });
    if (error) {
      console.error("[access-password] 발송 기록 조회 실패 — 비밀번호 없이 보냄:", error.message);
      return null;
    }
    return data?.some((f) => f.name === key.slice(slash + 1)) ? null : password;
  } catch (err) {
    console.error("[access-password] 발송 기록 확인 실패 — 비밀번호 없이 보냄:", err);
    return null;
  }
}

/** 비밀번호가 담긴 알림이 실제로 발송된 뒤에 호출 — 다음부터는 이 사람에게 비밀번호를 넣지 않음. */
export async function markPasswordSent(email: string): Promise<void> {
  try {
    await ensureBucket();
    const { error } = await getSupabase()
      .storage.from(BUCKET)
      .upload(keyFor(email), new Uint8Array([49]), { contentType: "text/plain", upsert: true });
    if (error) console.error("[access-password] 발송 기록 저장 실패:", error.message);
  } catch (err) {
    console.error("[access-password] 발송 기록 저장 중 오류:", err);
  }
}
