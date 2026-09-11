import Pop3Command from "node-pop3";
import { simpleParser } from "mailparser";

export interface MailSummary {
  msgNum: number;
  from: string;
  subject: string;
  date: string;
  hasAttachment: boolean;
  snippet: string;
}

const COMMAND_TIMEOUT_MS = 15_000;
const CHUNK_SIZE = 25; // reconnect every N messages so one long session can't idle-timeout on the server
const CHUNK_WALLCLOCK_TIMEOUT_MS = 45_000; // hard ceiling per chunk — protects against a hang that per-command timeouts don't catch (e.g. during the connect/auth handshake)

// Safety net: a POP3/TLS socket can emit a late 'error' event after its owning promise has
// already settled (e.g. the server force-closes the connection a moment after we've moved on).
// An unhandled event-emitter 'error' — or any unhandled rejection — crashes the entire Node
// process by default, which took down the whole dev server during testing. Demo-tool tradeoff:
// this logs and swallows *any* unhandled error app-wide rather than let that happen again.
declare global {
  // eslint-disable-next-line no-var
  var __mailProcessGuardsInstalled: boolean | undefined;
}
if (typeof process !== "undefined" && !globalThis.__mailProcessGuardsInstalled) {
  globalThis.__mailProcessGuardsInstalled = true;
  process.on("unhandledRejection", (reason) => {
    console.error("[mail] Unhandled rejection (suppressed to keep the server alive):", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[mail] Uncaught exception (suppressed to keep the server alive):", err);
  });
}

function createClient(): InstanceType<typeof Pop3Command> {
  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT || 995);
  const user = process.env.MAIL_USER;
  const password = process.env.MAIL_PASSWORD;
  if (!host || !user || !password) {
    throw new Error("메일 서버 환경변수(MAIL_HOST/MAIL_USER/MAIL_PASSWORD)가 .env.local에 설정되어 있지 않습니다.");
  }
  return new Pop3Command({ host, port, user, password, tls: port === 995, timeout: COMMAND_TIMEOUT_MS });
}

/** Runs `fn` with a fresh POP3 client, guaranteeing QUIT is attempted and errors never leak as unhandled rejections. */
async function withClient<T>(fn: (pop3: InstanceType<typeof Pop3Command>) => Promise<T>): Promise<T> {
  const pop3 = createClient();
  try {
    return await fn(pop3);
  } finally {
    await pop3.QUIT().catch(() => {});
  }
}

async function safeParseHeader(raw: string) {
  try {
    return await simpleParser(raw);
  } catch {
    return null;
  }
}

function naiveHeaderLookup(raw: string, header: string): string | undefined {
  const match = raw.match(new RegExp(`^${header}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Races a promise against a hard wall-clock timeout so a stuck connect/auth handshake can't hang forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} 타임아웃 (${ms}ms)`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function summarizeOne(pop3: InstanceType<typeof Pop3Command>, msgNum: number): Promise<MailSummary | null> {
  try {
    const raw = (await pop3.TOP(msgNum, 12)) as string;
    const parsed = await safeParseHeader(raw);

    const from = parsed?.from?.text ?? naiveHeaderLookup(raw, "From") ?? "(알 수 없음)";
    const subject = parsed?.subject ?? naiveHeaderLookup(raw, "Subject") ?? "(제목 없음)";
    const date = parsed?.date ? parsed.date.toISOString() : (naiveHeaderLookup(raw, "Date") ?? "");
    const hasAttachment = /Content-Type:\s*multipart\/(mixed|related)/i.test(raw);
    const bodyText = parsed?.text ?? "";
    const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 200);

    return { msgNum, from, subject, date, hasAttachment, snippet };
  } catch (err) {
    console.error(`메일 #${msgNum} 조회 실패, 건너뜁니다:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetches the most recent `limit` messages' headers + a short body snippet via POP3 TOP,
 * without downloading full message bodies/attachments. Newest messages are assumed to have
 * the highest message numbers (true for essentially all POP3 servers, since message numbers
 * are assigned in arrival order for the current session).
 *
 * Reconnects every CHUNK_SIZE messages — some POP3 servers enforce short idle/command
 * timeouts, and a single long-lived session issuing many sequential commands risks the
 * server dropping the connection mid-batch.
 */
export async function fetchRecentMailSummaries(limit: number): Promise<MailSummary[]> {
  const targets = await withClient(async (pop3) => {
    const listResult = (await pop3.LIST()) as string[][];
    return listResult
      .map(([num]) => Number(num))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a)
      .slice(0, limit);
  });

  const summaries: MailSummary[] = [];
  let chunkIndex = 0;
  const totalChunks = Math.ceil(targets.length / CHUNK_SIZE);
  for (const batch of chunk(targets, CHUNK_SIZE)) {
    chunkIndex++;
    const batchResults = await withTimeout(
      withClient(async (pop3) => {
        const results: MailSummary[] = [];
        for (const msgNum of batch) {
          const summary = await summarizeOne(pop3, msgNum);
          if (summary) results.push(summary);
        }
        return results;
      }),
      CHUNK_WALLCLOCK_TIMEOUT_MS,
      `메일 배치 조회(${chunkIndex}/${totalChunks})`
    ).catch((err) => {
      console.error(`메일 배치 조회 실패(${chunkIndex}/${totalChunks}), 해당 배치를 건너뜁니다:`, err instanceof Error ? err.message : err);
      return [];
    });
    console.log(`[mail] 배치 ${chunkIndex}/${totalChunks} 완료 — 누적 ${summaries.length + batchResults.length}통`);
    summaries.push(...batchResults);
  }
  return summaries;
}

export interface FullMailContent {
  msgNum: number;
  from: string;
  subject: string;
  date: string;
  text: string;
  attachments: { filename: string; size: number }[];
}

/**
 * Fetches and fully parses one message on demand (via POP3 RETR, unlike the TOP-based summary
 * fetch) — used when the dashboard's "전체 보기" is clicked. Only plain text is returned (not
 * HTML) to avoid rendering untrusted remote content; attachment bytes are not downloaded, only
 * their names/sizes.
 */
export async function fetchFullMessage(msgNum: number): Promise<FullMailContent> {
  return withTimeout(
    withClient(async (pop3) => {
      const raw = (await pop3.RETR(msgNum)) as string;
      const parsed = await simpleParser(raw);

      const from = parsed.from?.text ?? naiveHeaderLookup(raw, "From") ?? "(알 수 없음)";
      const subject = parsed.subject ?? naiveHeaderLookup(raw, "Subject") ?? "(제목 없음)";
      const date = parsed.date ? parsed.date.toISOString() : (naiveHeaderLookup(raw, "Date") ?? "");
      const text = (parsed.text ?? "").trim();
      const attachments = (parsed.attachments ?? []).map((a) => ({
        filename: a.filename ?? "(이름 없음)",
        size: a.size,
      }));

      return { msgNum, from, subject, date, text, attachments };
    }),
    CHUNK_WALLCLOCK_TIMEOUT_MS,
    `메일 #${msgNum} 전체 조회`
  );
}

export async function countMessages(): Promise<number> {
  return withClient(async (pop3) => {
    const stat = (await pop3.STAT()) as string; // "<count> <size> octets"
    const count = Number(stat.trim().split(/\s+/)[0]);
    return Number.isFinite(count) ? count : 0;
  });
}
