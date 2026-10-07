import { getSupabase } from "./db/supabaseClient";

export const IR_UPLOAD_BUCKET = "ir-uploads";
// Vercel 서버리스는 요청 본문이 4.5MB를 넘으면 앞단에서 거절(FUNCTION_PAYLOAD_TOO_LARGE)해서, IR 같은
// 큰 파일은 서버를 거치지 않고 브라우저가 이 버킷으로 바로 올린 뒤 경로만 서버로 넘김.
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const STALE_MS = 24 * 60 * 60 * 1000;

let bucketEnsured = false;

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const { error } = await getSupabase().storage.createBucket(IR_UPLOAD_BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_BYTES,
    allowedMimeTypes: ["application/pdf"],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`업로드 저장소 준비 실패: ${error.message}`);
  }
  bucketEnsured = true;
}

/** 업로드만 하고 평가를 안 돌린 채 떠난 파일이 쌓이지 않도록, 하루 지난 임시 파일을 지움(베스트 에포트). */
async function removeStaleUploads(): Promise<void> {
  try {
    const storage = getSupabase().storage.from(IR_UPLOAD_BUCKET);
    const { data } = await storage.list("", { limit: 200 });
    const stale = (data ?? [])
      .filter((f) => f.created_at && Date.now() - new Date(f.created_at).getTime() > STALE_MS)
      .map((f) => f.name);
    if (stale.length > 0) await storage.remove(stale);
  } catch (err) {
    console.error("[ir-uploads] 오래된 임시 파일 정리 실패:", err);
  }
}

export async function createUploadTarget(): Promise<{ path: string; signedUrl: string }> {
  await ensureBucket();
  await removeStaleUploads();
  const path = `${crypto.randomUUID()}.pdf`;
  const { data, error } = await getSupabase().storage.from(IR_UPLOAD_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`업로드 주소 발급 실패: ${error?.message ?? "알 수 없음"}`);
  return { path, signedUrl: data.signedUrl };
}

export async function downloadUpload(path: string): Promise<Buffer> {
  const { data, error } = await getSupabase().storage.from(IR_UPLOAD_BUCKET).download(path);
  if (error || !data) throw new Error("업로드한 파일을 찾을 수 없어요. 다시 업로드해 주세요.");
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteUpload(path: string): Promise<void> {
  const { error } = await getSupabase().storage.from(IR_UPLOAD_BUCKET).remove([path]);
  if (error) console.error(`[ir-uploads] ${path} 삭제 실패:`, error.message);
}

// ── 영구 보관: 공개 페이지로 제출된 IR 원본. 심사역이 /ir-deals에서 원문을 열람하고 다시 평가할 수 있게 평가 id로 저장.
const SUBMISSION_BUCKET = "ir-submissions";
let submissionBucketEnsured = false;

async function ensureSubmissionBucket(): Promise<void> {
  if (submissionBucketEnsured) return;
  const { error } = await getSupabase().storage.createBucket(SUBMISSION_BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_BYTES,
    allowedMimeTypes: ["application/pdf"],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`제출 파일 저장소 준비 실패: ${error.message}`);
  }
  submissionBucketEnsured = true;
}

const submissionPath = (evaluationId: number) => `platform-${evaluationId}.pdf`;

export async function saveSubmissionFile(evaluationId: number, buffer: Buffer): Promise<void> {
  await ensureSubmissionBucket();
  const { error } = await getSupabase()
    .storage.from(SUBMISSION_BUCKET)
    .upload(submissionPath(evaluationId), buffer, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`제출 파일 저장 실패: ${error.message}`);
}

export async function submissionFileExists(evaluationId: number): Promise<boolean> {
  const { data, error } = await getSupabase().storage.from(SUBMISSION_BUCKET).exists(submissionPath(evaluationId));
  return !error && data === true;
}

/** 파일이 없으면 null. */
export async function downloadSubmissionFile(evaluationId: number): Promise<Buffer | null> {
  const { data, error } = await getSupabase().storage.from(SUBMISSION_BUCKET).download(submissionPath(evaluationId));
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
