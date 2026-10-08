// 알림 메일 공통 조각 — 관리자 플랫폼으로 바로 들어가는 버튼과 푸터.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const ALERT_FOOTER_TEXT = "이 메일은 안다아시아벤처스 AI 심사역 플랫폼이 자동으로 분류·발송한 알림이에요.";

/** 눌러서 바로 관리자 플랫폼으로 가는 버튼(이메일 클라이언트 호환을 위해 인라인 스타일 + 표 없이 단순 링크) */
/** pw를 주면 링크 옆에 접속 비밀번호를 함께 적음 — 받는 사람이 처음 받는 알림에만 넘김(lib/mail/accessPassword.ts). */
export function platformButtonHtml(url: string, label = "관리자 플랫폼에서 확인하기", pw: string | null = null): string {
  return `<p style="margin:24px 0 8px;">
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#304b2a;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;">${escapeHtml(label)}</a>
  </p>
  ${pw ? `<p style="margin:0 0 8px;font-size:14px;">접속 비밀번호: <b style="font-family:Consolas,monospace;background:#f1f4ef;padding:2px 8px;border-radius:4px;">${escapeHtml(pw)}</b></p>` : ""}
  <p style="margin:0 0 20px;color:#777;font-size:12px;">버튼이 안 열리면 이 주소를 복사해 주세요: <a href="${escapeHtml(url)}" style="color:#777;">${escapeHtml(url)}</a></p>`;
}

export function platformLinkText(url: string, label = "관리자 플랫폼에서 확인하기", pw: string | null = null): string {
  return `${label}: ${url}${pw ? `
접속 비밀번호: ${pw}` : ""}`;
}

export function layoutHtml(inner: string): string {
  return `<div style="font-family:'Malgun Gothic',sans-serif;font-size:14px;color:#111;max-width:680px;">
    ${inner}
    <p style="color:#999;font-size:12px;margin-top:24px;">(${escapeHtml(ALERT_FOOTER_TEXT)})</p>
  </div>`;
}
