import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { countMessages, fetchRecentMailSummaries } from "@/lib/mail/client";
import { MODEL, SYSTEM_PROMPT, CLASSIFY_TOOL, formatMailBatch, chunkMails } from "@/lib/mail/classify";
import { readPendingJob, writePendingJob } from "@/lib/mail/backlogStore";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Kicks off full-mailbox backlog classification via the Anthropic Message Batches API.
 * POP3 access happens here (inside the working Next.js server) — the batch is then polled
 * and finalized by a separate standalone script that never touches POP3.
 */
export async function POST(req: Request) {
  const existing = readPendingJob();
  if (existing) {
    return NextResponse.json(
      { error: "이미 처리 중인 백로그 작업이 있습니다.", pending: existing },
      { status: 409 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY가 설정되어 있지 않습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");

  const total = await countMessages();
  const limit = limitParam ? Math.min(Number(limitParam), total) : total;

  const mails = await fetchRecentMailSummaries(limit);
  if (mails.length === 0) {
    return NextResponse.json({ error: "메일을 하나도 가져오지 못했습니다." }, { status: 500 });
  }

  const chunks = chunkMails(mails);
  const client = new Anthropic({ apiKey });

  const batch = await client.messages.batches.create({
    requests: chunks.map((chunk, i) => ({
      custom_id: `chunk-${i}`,
      params: {
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `다음 이메일 목록을 분류하세요.\n\n${formatMailBatch(chunk)}` }],
        tools: [CLASSIFY_TOOL],
        tool_choice: { type: "tool", name: "classify_mails" },
      },
    })),
  });

  writePendingJob({
    batchId: batch.id,
    submittedAt: new Date().toISOString(),
    totalInMailbox: total,
    mails,
  });

  return NextResponse.json({
    batchId: batch.id,
    submittedCount: mails.length,
    totalInMailbox: total,
    chunkCount: chunks.length,
  });
}

export async function GET() {
  const pending = readPendingJob();
  if (!pending) {
    return NextResponse.json({ pending: null });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ pending, status: null });
  }
  const client = new Anthropic({ apiKey });
  const batch = await client.messages.batches.retrieve(pending.batchId);

  return NextResponse.json({
    pending,
    status: batch.processing_status,
    requestCounts: batch.request_counts,
  });
}
