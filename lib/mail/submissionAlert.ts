import { listPersonas } from "../personas/store";
import { listAdminTeamMembers } from "../adminTeam/store";
import type { EvaluationReport } from "../reportSchema";
import { dealLink, homeLink } from "../appUrl";
import { sendEmail } from "./sendEmail";
import { hasEarlierPlatformSubmission } from "../evaluations/store";
import { escapeHtml, layoutHtml, platformButtonHtml, platformLinkText } from "./alertLayout";

// 투자기업 페이지(플랫폼)로 새 투자 제안이 제출되면 심사역(투자팀) 전원에게 알림 — 메일로 들어온 IR과 같은 수신자 규칙.
// 등록된 심사역이 없으면 관리팀이 받음. 제목: "[회사명] 새 투자 제안 도착"

const ATTACH_LIMIT_BYTES = 15 * 1024 * 1024; // 메일 첨부 한도(Resend 40MB, base64 팽창 고려)보다 넉넉히 낮게

export async function sendSubmissionAlert(input: {
  evaluationId: number;
  report: EvaluationReport;
  domainLabel: string;
  filename: string;
  file?: Buffer;
}): Promise<{ sent: number; failed: number; skipped?: "repeat" | "no-recipient" }> {
  const sub = input.report.submission;
  if (!sub) return { sent: 0, failed: 0 };

  // 같은 회사가 다시 올린 경우(자료 보완 재제출 등)에는 알림을 보내지 않음 — 제출 자체는 저장되고 목록에는 보임
  if (await hasEarlierPlatformSubmission(input.evaluationId, sub.companyName)) {
    return { sent: 0, failed: 0, skipped: "repeat" };
  }

  const [personas, admins] = await Promise.all([listPersonas(), listAdminTeamMembers()]);
  const reviewers = personas.filter((p) => p.email && !p.isDefault).map((p) => ({ name: p.name, email: p.email! }));
  const recipients = reviewers.length > 0 ? reviewers : admins.map((m) => ({ name: m.name, email: m.email }));
  if (recipients.length === 0) return { sent: 0, failed: 0, skipped: "no-recipient" };
  const team = reviewers.length > 0 ? "investment" : "admin";

  const link = dealLink(`platform-${input.evaluationId}`);
  const snapshot = (input.report.companySnapshot ?? "").split(/\n+/).filter(Boolean);
  const score = input.report.totalScore;
  const rows: [string, string][] = [
    ["회사", sub.companyName],
    ["제안 영역", input.domainLabel],
    ["담당자", sub.contactName],
    ["이메일", sub.contactEmail],
    ...(sub.contactPhone ? ([["연락처", sub.contactPhone]] as [string, string][]) : []),
    ["접수 시각", new Date(sub.submittedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })],
  ];

  const text = [
    "투자기업 페이지로 새 투자 제안이 제출됐어요.",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "[남긴 코멘트]",
    sub.comment || "(없음)",
    ...(snapshot.length ? ["", "[AI 심사역 요약]", ...snapshot.map((l) => `· ${l}`), `자료 충실도 ${score}/100 (참고용)`] : []),
    "",
    platformLinkText(link, "관리자 플랫폼에서 확인하기"),
    `전체 목록: ${homeLink()}`,
  ].join("\n");

  const html = layoutHtml(`
    <p style="font-size:16px;font-weight:bold;margin:0 0 12px;">새 투자 제안이 제출됐어요</p>
    <table style="border-collapse:collapse;font-size:14px;">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:3px 16px 3px 0;color:#777;white-space:nowrap;">${escapeHtml(k)}</td><td style="padding:3px 0;">${escapeHtml(v)}</td></tr>`
        )
        .join("")}
    </table>
    <p style="margin:18px 0 4px;font-weight:bold;">남긴 코멘트</p>
    <p style="margin:0;white-space:pre-wrap;">${escapeHtml(sub.comment || "(없음)")}</p>
    ${
      snapshot.length
        ? `<p style="margin:18px 0 4px;font-weight:bold;">AI 심사역 요약</p>
    <ul style="margin:0;padding-left:18px;">${snapshot.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
    <p style="margin:4px 0 0;color:#777;font-size:12px;">자료 충실도 ${score}/100 (참고용)</p>`
        : ""
    }
    ${platformButtonHtml(link)}`);

  const attachments =
    input.file && input.file.length <= ATTACH_LIMIT_BYTES ? [{ filename: input.filename, content: input.file }] : undefined;

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const result = await sendEmail({
      to: r.email,
      // 알림 메일 공통 형식: 받는 팀을 앞에 — "[투자팀] 새 투자 제안 도착_회사명"
      subject: `[${team === "investment" ? "투자팀" : "관리팀"}] 새 투자 제안 도착_${sub.companyName}`,
      team,
      text,
      html,
      attachments,
    });
    if (result.ok) sent++;
    else {
      failed++;
      console.error(`[submission-alert] ${r.email} 발송 실패:`, result.error);
    }
  }
  return { sent, failed };
}
