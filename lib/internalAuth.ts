// 직원 플랫폼 로그인 세션 — 쿠키에 비밀번호 자체를 넣지 않고, 만료 시각 + HMAC 서명만 넣음.
// 쿠키가 유출돼도 비밀번호는 노출되지 않고, 만료되면 쓸 수 없으며, 비밀번호를 바꾸면 기존 세션이 전부 무효가 됨.
// Web Crypto만 써서 proxy(미들웨어)와 라우트 양쪽에서 같은 코드를 씀.

export const AUTH_COOKIE = "internal_auth";
export const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7일

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

export async function createSessionToken(password: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${exp}.${await hmacHex(password, String(exp))}`;
}

export async function verifySessionToken(token: string | undefined, password: string): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(sig, await hmacHex(password, exp));
}
