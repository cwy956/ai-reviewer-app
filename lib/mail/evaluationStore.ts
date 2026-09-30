import { getSupabase } from "../db/supabaseClient";
import type { EvaluationReport } from "../reportSchema";

export interface MailEvaluationSummary {
  msgNum: number;
  domainId: string;
  personaId: string;
  personaName: string;
  attachmentFilename: string;
  totalScore: number;
  investmentAttractivenessScore: number | null;
  evaluatedAt: string;
}

export interface MailEvaluation extends MailEvaluationSummary {
  attachmentIndex: number;
  report: EvaluationReport;
}

function rowToSummary(row: Record<string, unknown>): MailEvaluationSummary {
  const report = row.report as EvaluationReport;
  return {
    msgNum: row.msg_num as number,
    domainId: row.domain_id as string,
    personaId: row.persona_id as string,
    personaName: row.persona_name as string,
    attachmentFilename: row.attachment_filename as string,
    totalScore: report.totalScore,
    investmentAttractivenessScore: report.investmentAttractiveness?.overallScore ?? null,
    evaluatedAt: row.evaluated_at as string,
  };
}

function rowToEvaluation(row: Record<string, unknown>): MailEvaluation {
  return {
    ...rowToSummary(row),
    attachmentIndex: row.attachment_index as number,
    report: row.report as EvaluationReport,
  };
}

/** Latest evaluation per msg_num, for the ones in `msgNums` — used to badge the IR list. */
export async function listLatestEvaluationsFor(msgNums: number[]): Promise<Map<number, MailEvaluationSummary>> {
  if (msgNums.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from("mail_evaluations")
    .select("msg_num, domain_id, persona_id, persona_name, attachment_filename, report, evaluated_at")
    .in("msg_num", msgNums)
    .order("evaluated_at", { ascending: false });
  if (error) throw new Error(`평가 결과 조회 실패: ${error.message}`);

  const latest = new Map<number, MailEvaluationSummary>();
  for (const row of data ?? []) {
    const summary = rowToSummary(row);
    if (!latest.has(summary.msgNum)) latest.set(summary.msgNum, summary);
  }
  return latest;
}

/** Every evaluation ever run for one mail, newest first — for the "평가 이력" list on that mail. */
export async function listEvaluationsForMail(msgNum: number): Promise<MailEvaluation[]> {
  const { data, error } = await getSupabase()
    .from("mail_evaluations")
    .select("*")
    .eq("msg_num", msgNum)
    .order("evaluated_at", { ascending: false });
  if (error) throw new Error(`평가 이력 조회 실패: ${error.message}`);
  return (data ?? []).map(rowToEvaluation);
}

export async function saveEvaluation(input: {
  msgNum: number;
  attachmentIndex: number;
  attachmentFilename: string;
  domainId: string;
  personaId: string;
  personaName: string;
  report: EvaluationReport;
}): Promise<MailEvaluation> {
  const { data, error } = await getSupabase()
    .from("mail_evaluations")
    .insert({
      msg_num: input.msgNum,
      attachment_index: input.attachmentIndex,
      attachment_filename: input.attachmentFilename,
      domain_id: input.domainId,
      persona_id: input.personaId,
      persona_name: input.personaName,
      report: input.report,
    })
    .select("*")
    .single();
  if (error) throw new Error(`평가 결과 저장 실패: ${error.message}`);
  return rowToEvaluation(data);
}
