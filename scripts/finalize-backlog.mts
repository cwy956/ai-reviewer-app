// Polls the Anthropic Message Batches API and finalizes the full-mailbox backlog
// classification job started via POST /api/mail/backlog/submit.
//
// Deliberately does NOT import node-pop3 (directly or transitively) — that package has an
// ESM/CJS interop bug that breaks under tsx's module resolution (see lib/mail/client.ts and
// the submit API route for where POP3 access actually happens, inside Next.js). This script
// only needs the Anthropic SDK + fs, so it's safe to run standalone with tsx.
//
// Usage:
//   npx tsx scripts/finalize-backlog.mts            # poll every 30s until done
//   npx tsx scripts/finalize-backlog.mts --once      # check status once and exit
//   npx tsx scripts/finalize-backlog.mts --interval 10

import path from "path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const { readPendingJob, writeBacklogCache, clearPendingJob } = await import("../lib/mail/backlogStore");
const { parseClassifyToolInput, mergeClassifications } = await import("../lib/mail/classify");
const { sendTeamsBacklogDigest } = await import("../lib/mail/notifyTeams");
type ClassifyFields = ReturnType<typeof parseClassifyToolInput> extends Map<number, infer V> ? V : never;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const once = args.includes("--once");
  const intervalFlagIdx = args.indexOf("--interval");
  const intervalSec = intervalFlagIdx >= 0 ? Number(args[intervalFlagIdx + 1]) : 30;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY가 .env.local에 없습니다.");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });

  for (;;) {
    const pending = readPendingJob();
    if (!pending) {
      console.log("대기 중인 백로그 작업이 없습니다. (이미 처리 완료됐거나, 아직 제출되지 않았습니다)");
      return;
    }

    const batch = await client.messages.batches.retrieve(pending.batchId);
    console.log(
      `[${new Date().toLocaleTimeString("ko-KR")}] batch=${pending.batchId} status=${batch.processing_status} ` +
        `counts=${JSON.stringify(batch.request_counts)}`
    );

    if (batch.processing_status === "ended") {
      console.log("배치 완료. 결과를 가져와 병합합니다...");

      const merged = new Map<number, ClassifyFields>();
      let succeeded = 0;
      let failed = 0;

      const resultsStream = await client.messages.batches.results(pending.batchId);
      for await (const item of resultsStream) {
        if (item.result.type === "succeeded") {
          const toolUse = item.result.message.content.find(
            (block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock => block.type === "tool_use"
          );
          const chunkMap = parseClassifyToolInput(toolUse?.input);
          for (const [k, v] of chunkMap) merged.set(k, v as ClassifyFields);
          succeeded++;
        } else {
          console.error(`  요청 실패 (custom_id=${item.custom_id}): ${item.result.type}`);
          failed++;
        }
      }

      const classified = mergeClassifications(pending.mails, merged);
      writeBacklogCache({
        processedAt: new Date().toISOString(),
        totalInMailbox: pending.totalInMailbox,
        mails: classified,
      });
      clearPendingJob();

      console.log(
        `완료: 메일 ${classified.length}통 분류됨 (요청 성공 ${succeeded} / 실패 ${failed}). ` +
          `lib/mail/backlog-cache.json 에 저장했습니다.`
      );

      const appUrl = process.env.APP_BASE_URL || "http://localhost:3000";
      const { reviewer, admin } = await sendTeamsBacklogDigest({
        totalInMailbox: pending.totalInMailbox,
        mails: classified,
        dashboardUrl: `${appUrl}/mailbox`,
      });
      for (const [label, result] of [
        ["심사역용", reviewer],
        ["관리팀용", admin],
      ] as const) {
        if (result.ok) {
          console.log(`Teams(${label}) 전송 완료.`);
        } else if (result.skipped) {
          console.log(`Teams(${label}) 웹훅 미설정 — 스킵.`);
        } else {
          console.log(`Teams(${label}) 전송 실패: ${result.error ?? result.status}`);
        }
      }
      return;
    }

    if (once) {
      console.log("아직 처리 중입니다. (--once 옵션이라 여기서 종료합니다. 잠시 후 다시 실행해 주세요)");
      return;
    }

    await sleep(intervalSec * 1000);
  }
}

main().catch((err) => {
  console.error("백로그 마무리 작업 중 오류:", err);
  process.exit(1);
});
