import { createHash, randomUUID } from "crypto";
import { getSupabase } from "./db/supabaseClient";

// 투자기업 페이지(공개)의 제출 횟수 제한 — 반복 업로드로 AI 비용이 빠지는 것을 막음.
//  1) IP당: 1시간 5건, 하루 10건
//  2) 전체: 하루 40건 (IP를 바꿔가며 올려도 비용에 천장이 생기게)
// 접수 기록은 Supabase Storage의 비공개 버킷에 빈 파일로 남김 → DB 표를 새로 만들 필요가 없고, 서버가 여러 개 뜨거나
// 재시작해도 정확히 셀 수 있음(메모리 방식은 그렇지 못함). IP는 원문이 아니라 해시만 저장.
// 한도는 환경변수(RATE_LIMIT_IP_HOURLY / RATE_LIMIT_IP_DAILY / RATE_LIMIT_GLOBAL_DAILY)로 조정 가능.

const BUCKET = "rate-limits";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

let bucketReady = false;
async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const { error } = await getSupabase().storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw new Error(`제한 기록 저장소 준비 실패: ${error.message}`);
  bucketReady = true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

const ipKey = (ip: string) => createHash("sha256").update(`anda-rl:${ip}`).digest("hex").slice(0, 20);
const kstDate = (t = Date.now()) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // 2026-10-08

export type RateLimitResult = { ok: true } | { ok: false; message: string; retryAfterSec: number };

function minutes(sec: number): number {
  return Math.max(1, Math.ceil(sec / 60));
}

/**
 * 제출을 시도할 수 있는지 확인하고, 허용되면 이번 시도를 기록.
 * 기록 도중 저장소 오류가 나면 제출을 막지 않음(제한 장치의 장애가 정상 사용자를 막으면 안 되므로) — 로그만 남김.
 */
export async function checkSubmissionRateLimit(req: Request): Promise<RateLimitResult> {
  const ipHourly = num("RATE_LIMIT_IP_HOURLY", 5);
  const ipDaily = num("RATE_LIMIT_IP_DAILY", 10);
  const globalDaily = num("RATE_LIMIT_GLOBAL_DAILY", 40);

  try {
    await ensureBucket();
    const storage = getSupabase().storage.from(BUCKET);
    const now = Date.now();
    const key = ipKey(clientIp(req));
    const today = kstDate(now);

    // 이 IP의 최근 기록(최신순) — 24시간이 지난 것은 같이 정리
    const { data: ipFiles } = await storage.list(`ip/${key}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    const times = (ipFiles ?? [])
      .map((f) => ({ name: f.name, t: f.created_at ? new Date(f.created_at).getTime() : 0 }))
      .filter((f) => f.t > 0);
    const stale = times.filter((f) => now - f.t > DAY_MS).map((f) => `ip/${key}/${f.name}`);
    if (stale.length > 0) void storage.remove(stale).catch(() => {});
    const dayTimes = times.filter((f) => now - f.t <= DAY_MS).map((f) => f.t).sort((a, b) => a - b); // 오래된 순
    const hourTimes = dayTimes.filter((t) => now - t <= HOUR_MS);

    if (hourTimes.length >= ipHourly) {
      const retry = Math.ceil((hourTimes[0] + HOUR_MS - now) / 1000);
      return { ok: false, retryAfterSec: retry, message: `짧은 시간에 제출이 너무 많아요. 약 ${minutes(retry)}분 뒤에 다시 시도해 주세요.` };
    }
    if (dayTimes.length >= ipDaily) {
      const retry = Math.ceil((dayTimes[0] + DAY_MS - now) / 1000);
      return { ok: false, retryAfterSec: retry, message: "오늘 제출 가능한 횟수를 넘었어요. 내일 다시 시도해 주세요." };
    }

    // 전체 일일 상한 (한국 날짜 기준)
    const { data: dayFiles } = await storage.list(`day/${today}`, { limit: globalDaily + 1 });
    if ((dayFiles?.length ?? 0) >= globalDaily) {
      return { ok: false, retryAfterSec: 3600, message: "오늘은 접수가 많아 더 받을 수 없어요. 내일 다시 시도해 주세요." };
    }

    // 허용 → 기록(IP별 + 전체). 어제 이전 날짜 폴더는 가끔 정리
    const marker = new Uint8Array([49]);
    const id = `${now}-${randomUUID().slice(0, 8)}`;
    await Promise.all([
      storage.upload(`ip/${key}/${id}`, marker, { contentType: "text/plain" }),
      storage.upload(`day/${today}/${id}`, marker, { contentType: "text/plain" }),
    ]);
    if (Math.random() < 0.05) void cleanOldDayFolders(today).catch(() => {});
    return { ok: true };
  } catch (err) {
    console.error("[rate-limit] 확인 실패 — 제한 없이 통과시킴:", err);
    return { ok: true };
  }
}

async function cleanOldDayFolders(today: string): Promise<void> {
  const storage = getSupabase().storage.from(BUCKET);
  const { data: folders } = await storage.list("day", { limit: 100 });
  for (const f of folders ?? []) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(f.name) && f.name < today) {
      const { data: files } = await storage.list(`day/${f.name}`, { limit: 1000 });
      if (files?.length) await storage.remove(files.map((x) => `day/${f.name}/${x.name}`));
    }
  }
}
