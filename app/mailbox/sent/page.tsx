"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS, type MailCategory } from "@/lib/mail/classify";
import { getDomain } from "@/lib/domains";

interface SendLogEntry {
  msgNum: number;
  subject: string;
  category: MailCategory;
  domainId: string | null;
  recipientEmail: string;
  recipientName?: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SentLogPage() {
  const [entries, setEntries] = useState<SendLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mail/send-log")
      .then((res) => res.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "불러오기에 실패했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const sentCount = entries.filter((e) => e.status === "sent").length;
  const failedCount = entries.filter((e) => e.status === "failed").length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-accent-soft">이메일 발송 이력</h1>
        <p className="mt-2 text-sm text-muted">
          메일 자동 감시가 각 담당자에게 실제로 보낸 이메일 발송 이력이에요. 어떤 메일이 누구에게 언제 갔는지 확인할
          수 있습니다.
        </p>
        <a href="/mailbox" className="mt-3 inline-block text-xs text-muted underline hover:text-accent-soft">
          ← 메일함 자동 분류로
        </a>
      </header>

      {loading && <p className="text-sm text-muted">불러오는 중...</p>}
      {error && <p className="rounded-md border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p>}

      {!loading && !error && (
        <>
          <div className="mb-4 flex gap-3 text-xs text-muted">
            <span className="rounded-full bg-good/10 px-3 py-1 text-good">발송 성공 {sentCount}건</span>
            <span className="rounded-full bg-bad/10 px-3 py-1 text-bad">발송 실패 {failedCount}건</span>
          </div>

          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-panel-border p-8 text-center text-sm text-muted">
              아직 발송 이력이 없어요. 신규 메일 알림이 나가면 여기 기록됩니다.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-panel-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2">시각</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">제목</th>
                    <th className="px-3 py-2">카테고리</th>
                    <th className="px-3 py-2">수신자</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={`${e.msgNum}-${e.recipientEmail}-${i}`} className="border-t border-panel-border">
                      <td className="px-3 py-2 text-xs text-muted">{formatDate(e.sentAt)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            e.status === "sent" ? "bg-good/15 text-good" : "bg-bad/15 text-bad"
                          }`}
                          title={e.error}
                        >
                          {e.status === "sent" ? "발송됨" : "실패"}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-3 py-2">{e.subject}</td>
                      <td className="px-3 py-2 text-xs text-muted">
                        {CATEGORY_LABELS[e.category]}
                        {e.domainId && ` · ${getDomain(e.domainId)?.label ?? e.domainId}`}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {e.recipientName ? `${e.recipientName} (${e.recipientEmail})` : e.recipientEmail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
