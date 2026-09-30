import { getDomain } from "../domains";
import { listPersonas } from "../personas/store";
import type { Persona } from "../personas/schema";
import { fetchAttachmentContent, fetchFullMessage } from "./client";
import { parsePdf } from "../parsePdf";
import { evaluateIr } from "../evaluate";
import { listEvaluationsForMail, saveEvaluation } from "../evaluations/store";
import type { ClassifiedMail } from "./classify";

/**
 * Auto-evaluates every classified 'ir' mail using the default (non-persona-specific) AI
 * reviewer, so /ir-deals already shows a score the moment a deal is classified — nobody has to
 * click "평가하기" first. Runs sequentially (one Claude round-trip pair per mail; avoids rate
 * limits) and is entirely best-effort: one mail's failure (no PDF attachment, parse error,
 * slow POP3, etc.) is logged and skipped, never thrown up to the caller — this must never be
 * allowed to jeopardize the notification/watch-state flow it's called after.
 */
export async function autoEvaluateIrMails(mails: ClassifiedMail[]): Promise<void> {
  const irMails = mails.filter((m) => m.category === "ir" && m.domainId && m.hasAttachment);
  if (irMails.length === 0) return;

  const personas = await listPersonas();
  const defaultPersona = personas.find((p) => p.isDefault);
  if (!defaultPersona) {
    console.error("[auto-evaluate] 기본 AI 심사역을 찾을 수 없어 자동 평가를 건너뜁니다.");
    return;
  }

  for (const mail of irMails) {
    try {
      await autoEvaluateOne(mail, defaultPersona);
    } catch (err) {
      console.error(
        `[auto-evaluate] 메일 #${mail.msgNum} 자동 평가 실패, 건너뜁니다 (나중에 /ir-deals에서 수동으로 평가할 수 있음):`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

async function autoEvaluateOne(mail: ClassifiedMail, defaultPersona: Persona): Promise<void> {
  const domain = getDomain(mail.domainId!);
  if (!domain) return;

  const existing = await listEvaluationsForMail(mail.msgNum);
  if (existing.some((e) => e.personaId === defaultPersona.id)) {
    return; // already auto-evaluated (e.g. a previous run got this far before timing out later)
  }

  const full = await fetchFullMessage(mail.msgNum);
  const pdfIndex = full.attachments.findIndex((a) => a.filename.toLowerCase().endsWith(".pdf"));
  if (pdfIndex === -1) {
    console.log(`[auto-evaluate] 메일 #${mail.msgNum}에 PDF 첨부파일이 없어 자동 평가를 건너뜁니다.`);
    return;
  }

  const attachment = await fetchAttachmentContent(mail.msgNum, pdfIndex);
  const parsed = await parsePdf(attachment.content);
  const report = await evaluateIr(defaultPersona, domain, parsed.markedText, {}, "internal");

  await saveEvaluation({
    source: "mail",
    msgNum: mail.msgNum,
    attachmentIndex: pdfIndex,
    attachmentFilename: attachment.filename,
    domainId: domain.id,
    personaId: defaultPersona.id,
    personaName: defaultPersona.name,
    report,
  });

  console.log(`[auto-evaluate] 메일 #${mail.msgNum} 자동 평가 완료 (totalScore=${report.totalScore})`);
}
