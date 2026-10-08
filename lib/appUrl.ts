/**
 * 알림 메일에 넣는 관리자 플랫폼 주소의 기준(origin).
 * APP_BASE_URL(환경변수)이 있으면 그것을, 없으면 Vercel 운영 도메인을, 그것도 없으면 현재 운영 주소를 씀.
 * (예전에는 값이 없으면 localhost로 들어가서 메일 속 링크가 열리지 않을 수 있었음.)
 */
export function appBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "https://ai-reviewer-app-taupe.vercel.app";
}

/** 로그인 후 해당 딜 팝업이 바로 열리는 링크 — key는 "mail-<번호>" 또는 "platform-<id>" */
export function dealLink(key: string): string {
  return `${appBaseUrl()}/ir-deals?open=${encodeURIComponent(key)}`;
}

export function homeLink(): string {
  return `${appBaseUrl()}/internal`;
}
