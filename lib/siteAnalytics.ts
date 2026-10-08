import { createSign } from "crypto";

// 홈페이지(andaasiavc.com) 방문 현황 — Google Analytics 4 Data API를 서비스 계정으로 읽음.
// 라이브러리 대신 REST + JWT 직접 서명: 의존성이 가볍고 서버리스에서 잘 돌아감.
// 필요한 환경변수: GA_PROPERTY_ID(숫자), GA_SERVICE_ACCOUNT_JSON(키 파일 JSON 전체 문자열, 또는 그것을 base64한 값)

export interface SiteAnalytics {
  realtimeUsers: number;
  /** 방문자수=activeUsers, 방문수=sessions */
  periods: { key: string; label: string; visitors: number; visits: number }[];
  daily: { date: string; visitors: number; visits: number }[];
  fetchedAt: string;
}

export class AnalyticsNotConfiguredError extends Error {}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GA_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw || !process.env.GA_PROPERTY_ID) {
    throw new AnalyticsNotConfiguredError("GA_PROPERTY_ID / GA_SERVICE_ACCOUNT_JSON이 설정되지 않았습니다.");
  }
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) throw new Error("서비스 계정 JSON 형식이 올바르지 않습니다.");
  return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") };
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claim}`).sign(sa.private_key);
  const assertion = `${header}.${claim}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`구글 인증 실패: ${json.error_description ?? json.error ?? res.status}`);
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

async function ga<T>(token: string, method: "runReport" | "runRealtimeReport", body: unknown): Promise<T> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROPERTY_ID}:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`GA 조회 실패(${method}): ${json.error?.message ?? res.status}`);
  return json as T;
}

interface Report {
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
}

const num = (v: string | undefined) => Number(v ?? 0) || 0;

const METRICS = [{ name: "activeUsers" }, { name: "sessions" }];

// 구글 Data API는 요청 하나당 기간을 4개까지만 받음 → 둘로 나눔
const RANGES_A = [
  { key: "today", label: "오늘", range: { startDate: "today", endDate: "today" } },
  { key: "yesterday", label: "어제", range: { startDate: "yesterday", endDate: "yesterday" } },
  { key: "week", label: "일주일", range: { startDate: "6daysAgo", endDate: "today" } },
  { key: "month", label: "한달", range: { startDate: "29daysAgo", endDate: "today" } },
];
const RANGES_B = [
  { key: "year", label: "일년", range: { startDate: "364daysAgo", endDate: "today" } },
  { key: "total", label: "합계", range: { startDate: "2020-01-01", endDate: "today" } }, // GA는 속성을 만든 날부터만 집계
];

async function periodReport(token: string, ranges: typeof RANGES_A) {
  const r = await ga<Report>(token, "runReport", {
    dateRanges: ranges.map((x, i) => ({ ...x.range, name: `r${i}` })),
    metrics: METRICS,
  });
  const byName = new Map<string, { visitors: number; visits: number }>();
  for (const row of r.rows ?? []) {
    byName.set(row.dimensionValues?.[0]?.value ?? "", {
      visitors: num(row.metricValues?.[0]?.value),
      visits: num(row.metricValues?.[1]?.value),
    });
  }
  return ranges.map((x, i) => ({ key: x.key, label: x.label, ...(byName.get(`r${i}`) ?? { visitors: 0, visits: 0 }) }));
}

let cache: { data: SiteAnalytics; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getSiteAnalytics(): Promise<SiteAnalytics> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const sa = loadServiceAccount();
  const token = await getAccessToken(sa);

  const [a, b, daily, realtime] = await Promise.all([
    periodReport(token, RANGES_A),
    periodReport(token, RANGES_B),
    ga<Report>(token, "runReport", {
      dateRanges: [{ startDate: "9daysAgo", endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: METRICS,
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    ga<Report>(token, "runRealtimeReport", { metrics: [{ name: "activeUsers" }] }),
  ]);

  // 기간이 없는 날도 0으로 채워서 10일치 그래프가 끊기지 않게 함
  const dailyMap = new Map<string, { visitors: number; visits: number }>();
  for (const row of daily.rows ?? []) {
    dailyMap.set(row.dimensionValues?.[0]?.value ?? "", {
      visitors: num(row.metricValues?.[0]?.value),
      visits: num(row.metricValues?.[1]?.value),
    });
  }
  const dailySeries: SiteAnalytics["daily"] = [];
  for (let i = 9; i >= 0; i--) {
    // 서버(UTC)가 아니라 한국 날짜 기준 — GA의 date 차원은 속성 시간대(서울) 기준이라 자정 전후로 어긋나지 않게 함
    const iso = new Date(Date.now() - i * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // 2026-10-08
    const [, m, d] = iso.split("-");
    dailySeries.push({ date: `${Number(m)}/${Number(d)}`, ...(dailyMap.get(iso.replace(/-/g, "")) ?? { visitors: 0, visits: 0 }) });
  }

  const data: SiteAnalytics = {
    realtimeUsers: num(realtime.rows?.[0]?.metricValues?.[0]?.value),
    periods: [...a, ...b],
    daily: dailySeries,
    fetchedAt: new Date().toISOString(),
  };
  cache = { data, at: Date.now() };
  return data;
}
