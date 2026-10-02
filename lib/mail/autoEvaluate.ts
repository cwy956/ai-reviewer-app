import { getDomain } from "../domains";
import { detectDomain } from "../detectDomain";
import { updateMailDomain } from "./backlogStore";
import { listPersonas } from "../personas/store";
import type { Persona } from "../personas/schema";
import { fetchFullMessage } from "./client";
import { setCachedMessage } from "./messageCache";
import { parsePdf, assessExtractionQuality } from "../parsePdf";
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

  // includeAttachmentContent: true — 같은 POP3 RETR로 첨부 바이트까지 받아서, 평가 후 이 결과를
  // 그대로 공유 캐시에 올려두면(아래 setCachedMessage) /ir-deals 팝업을 처음 여는 사람조차 POP3를
  // 안 타게 됨. 예전엔 여기서 fetchFullMessage + fetchAttachmentContent로 같은 메시지를 두 번
  // RETR했음.
  const full = await fetchFullMessage(mail.msgNum, { includeAttachmentContent: true });
  const pdfAttachment = full.attachments.find((a) => a.content);
  if (!pdfAttachment) {
    console.log(`[auto-evaluate] 메일 #${mail.msgNum}에 PDF 첨부파일이 없어 자동 평가를 건너뜁니다.`);
    return;
  }

  const parsed = await parsePdf(Buffer.from(pdfAttachment.content!, "base64"));
  // 분류 단계는 본문 200자만 봐서 PDF에만 내용이 있는 IR은 "기타"로 떨어졌음 — 자료를 읽고 영역 보정
  const detected = await detectDomain(parsed.markedText);
  const evalDomain = (detected && getDomain(detected.domainId)) || domain;
  if (evalDomain.id !== domain.id) await updateMailDomain(mail.msgNum, evalDomain.id);

  const report = await evaluateIr(defaultPersona, evalDomain, parsed.markedText, {}, "internal");
  report.extractionQuality = assessExtractionQuality(parsed);

  await saveEvaluation({
    source: "mail",
    msgNum: mail.msgNum,
    companyName: report.companyName || undefined,
    attachmentIndex: pdfAttachment.index,
    attachmentFilename: pdfAttachment.filename,
    domainId: evalDomain.id,
    personaId: defaultPersona.id,
    personaName: defaultPersona.name,
    report,
  });

  await setCachedMessage(mail.msgNum, full);

  console.log(`[auto-evaluate] 메일 #${mail.msgNum} 자동 평가 완료 (totalScore=${report.totalScore})`);
}
