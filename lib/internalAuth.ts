// 직원 플랫폼 로그인 세션 — 쿠키에 비밀번호 자체를 넣지 않고, 발급·만료 시각 + HMAC 서명만 넣음.
// 쿠키가 유출돼도 비밀번호는 노출되지 않고, 만료되면 쓸 수 없으며, 비밀번호를 바꾸면 기존 세션이 전부 무효가 됨.
// Web Crypto만 써서 proxy(미들웨어)와 라우트 양쪽에서 같은 코드를 씀.
//
// 만료 정책: "2시간 동안 활동이 없으면 만료"(사용할 때마다 연장) + "로그인 후 최대 12시간"이 절대 상한.
// 일하는 중에 2시간마다 갑자기 로그아웃되지 않으면서, 쿠키가 하루종일 살아 있지는 않게 함.

export const AUTH_COOKIE = "internal_auth";
export const SESSION_SECONDS = 60 * 60 * 2; // 활동이 없을 때 만료까지의 시간(2시간)
export const ABSOLUTE_SESSION_SECONDS = 60 * 60 * 12; // 로그인 후 최대 유지 시간(12시간)
const RENEW_AFTER_SECONDS = 60 * 10; // 마지막 갱신 후 10분이 지나면 다음 요청에서 만료를 다시 2시간 뒤로 연장

const enc = new TextEncoder();

async function hmacHex(password: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(`anda-session:${password}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const nowSec = () => Math.floor(Date.now() / 1000);

/** 토큰 형식: `발급시각.만료시각.서명` */
export async function createSessionToken(password: string, issuedAt = nowSec(), now = nowSec()): Promise<string> {
  const exp = now + SESSION_SECONDS;
  return `${issuedAt}.${exp}.${await hmacHex(password, `${issuedAt}.${exp}`)}`;
}

export interface SessionCheck {
  valid: boolean;
  /** 사용 중이라 만료를 연장해야 하면 새 토큰 */
  renewedToken?: string;
}

export async function checkSession(token: string | undefined, password: string): Promise<SessionCheck> {
  if (!token) return { valid: false };
  const [iatStr, expStr, sig] = token.split(".");
  if (!iatStr || !expStr || !sig || !/^\d+$/.test(iatStr) || !/^\d+$/.test(expStr)) return { valid: false };
  const iat = Number(iatStr);
  const exp = Number(expStr);
  const now = nowSec();
  if (exp < now) return { valid: false }; // 활동 없이 2시간이 지남
  if (now - iat > ABSOLUTE_SESSION_SECONDS) return { valid: false }; // 로그인 후 12시간이 지남
  if (!safeEqual(sig, await hmacHex(password, `${iat}.${exp}`))) return { valid: false };

  // 마지막으로 연장한 지 10분이 지났으면 새 토큰으로 갈아끼움(너무 자주 쿠키를 다시 쓰지 않으려고 10분 단위)
  const lastRenewed = exp - SESSION_SECONDS;
  if (now - lastRenewed > RENEW_AFTER_SECONDS) {
    return { valid: true, renewedToken: await createSessionToken(password, iat, now) };
  }
  return { valid: true };
}
