import { getSupabase } from "../db/supabaseClient";
import type { EvaluationReport, PeerResearchResult } from "../reportSchema";

export type EvaluationSource = "mail" | "platform";

export interface IrEvaluationSummary {
  id: number;
  source: EvaluationSource;
  msgNum: number | null;
  companyName: string | null;
  companyTagline: string | null;
  subDomain: string | null;
  domainId: string;
  personaId: string;
  personaName: string;
  attachmentFilename: string;
  totalScore: number;
  investmentAttractivenessScore: number | null;
  evaluatedAt: string;
}

export interface IrEvaluation extends IrEvaluationSummary {
  attachmentIndex: number;
  report: EvaluationReport;
}

function rowToSummary(row: Record<string, unknown>): IrEvaluationSummary {
  const report = row.report as EvaluationReport;
  return {
    id: row.id as number,
    source: row.source as EvaluationSource,
    msgNum: (row.msg_num as number | null) ?? null,
    companyName: (row.company_name as string | null) ?? null,
    companyTagline: report.companyTagline || null,
    subDomain: report.subDomain || null,
    domainId: row.domain_id as string,
    personaId: row.persona_id as string,
    personaName: row.persona_name as string,
    attachmentFilename: row.attachment_filename as string,
    totalScore: report.totalScore,
    investmentAttractivenessScore: report.investmentAttractiveness?.overallScore ?? null,
    evaluatedAt: row.evaluated_at as string,
  };
}

function rowToEvaluation(row: Record<string, unknown>): IrEvaluation {
  return {
    ...rowToSummary(row),
    attachmentIndex: row.attachment_index as number,
    report: row.report as EvaluationReport,
  };
}

/** Latest mail-sourced evaluation per msg_num, for the ones in `msgNums` — badges the IR list. */
export async function listLatestMailEvaluationsFor(msgNums: number[]): Promise<Map<number, IrEvaluationSummary>> {
  if (msgNums.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from("ir_evaluations")
    .select("id, source, msg_num, company_name, domain_id, persona_id, persona_name, attachment_filename, report, evaluated_at")
    .eq("source", "mail")
    .in("msg_num", msgNums)
    .order("evaluated_at", { ascending: false });
  if (error) throw new Error(`평가 결과 조회 실패: ${error.message}`);

  const latest = new Map<number, IrEvaluationSummary>();
  for (const row of data ?? []) {
    const summary = rowToSummary(row);
    if (summary.msgNum !== null && !latest.has(summary.msgNum)) latest.set(summary.msgNum, summary);
  }
  return latest;
}

/** Every mail-sourced evaluation ever run for one mail, newest first — for "평가 이력". */
export async function listEvaluationsForMail(msgNum: number): Promise<IrEvaluation[]> {
  const { data, error } = await getSupabase()
    .from("ir_evaluations")
    .select("*")
    .eq("source", "mail")
    .eq("msg_num", msgNum)
    .order("evaluated_at", { ascending: false });
  if (error) throw new Error(`평가 이력 조회 실패: ${error.message}`);
  return (data ?? []).map(rowToEvaluation);
}

/** Every platform submission (summary only, no report body), newest first — for the IR list. */
export async function listPlatformSubmissionSummaries(): Promise<IrEvaluationSummary[]> {
  const { data, error } = await getSupabase()
    .from("ir_evaluations")
    .select("id, source, msg_num, company_name, domain_id, persona_id, persona_name, attachment_filename, report, evaluated_at")
    .eq("source", "platform")
    .order("evaluated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`플랫폼 제출 목록 조회 실패: ${error.message}`);
  return (data ?? []).map(rowToSummary);
}

/** One evaluation by id, regardless of source — used by peer research, which only has the
 * evaluation id to go on (the client already knows the deal title/domain, so no join needed). */
export async function getEvaluationById(id: number): Promise<IrEvaluation | null> {
  const { data, error } = await getSupabase().from("ir_evaluations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`평가 결과 조회 실패: ${error.message}`);
  return data ? rowToEvaluation(data) : null;
}

/** Merges peer research into an already-saved report (run on demand, after the main evaluation
 * exists) — read-modify-write since the report column is one jsonb blob, not a set of columns. */
export async function updatePeerResearch(id: number, peerResearch: PeerResearchResult): Promise<void> {
  const evaluation = await getEvaluationById(id);
  if (!evaluation) throw new Error("평가 결과를 찾을 수 없습니다.");
  const updatedReport: EvaluationReport = { ...evaluation.report, peerResearch };
  const { error } = await getSupabase().from("ir_evaluations").update({ report: updatedReport }).eq("id", id);
  if (error) throw new Error(`피어 리서치 저장 실패: ${error.message}`);
}

/** One platform submission's full report, for the detail modal. */
export async function getPlatformSubmission(id: number): Promise<IrEvaluation | null> {
  const { data, error } = await getSupabase()
    .from("ir_evaluations")
    .select("*")
    .eq("source", "platform")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`플랫폼 제출 조회 실패: ${error.message}`);
  return data ? rowToEvaluation(data) : null;
}

/** 같은 제출을 다시 평가했을 때 기존 행의 결과를 갈아끼움(플랫폼 제출은 딜 하나 = 행 하나라 이력을 쌓지 않음). */
export async function updateEvaluationReport(
  id: number,
  input: { domainId: string; personaId: string; personaName: string; report: EvaluationReport }
): Promise<IrEvaluation> {
  const { data, error } = await getSupabase()
    .from("ir_evaluations")
    .update({
      domain_id: input.domainId,
      persona_id: input.personaId,
      persona_name: input.personaName,
      report: input.report,
      evaluated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`평가 결과 갱신 실패: ${error.message}`);
  return rowToEvaluation(data);
}

/** 회사명 비교용 정규화 — 공백·㈜·(주)·주식회사·대소문자 차이를 무시 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/㈜|\(주\)|주식회사|\(유\)|유한회사/g, "")
    .replace(/[\s\-_.,()·]/g, "");
}

/** 같은 회사가 이전에 플랫폼으로 제출한 적이 있는지 (이번 건 제외). 알림 중복 방지에 사용. */
export async function hasEarlierPlatformSubmission(evaluationId: number, companyName: string): Promise<boolean> {
  const target = normalizeCompanyName(companyName);
  if (!target) return false;
  const { data, error } = await getSupabase()
    .from("ir_evaluations")
    .select("company_name")
    .eq("source", "platform")
    .lt("id", evaluationId)
    .limit(2000);
  if (error) throw new Error(`이전 제출 조회 실패: ${error.message}`);
  return (data ?? []).some((row) => normalizeCompanyName((row.company_name as string | null) ?? "") === target);
}

export async function saveEvaluation(input: {
  source: EvaluationSource;
  msgNum?: number;
  companyName?: string;
  attachmentIndex?: number;
  attachmentFilename: string;
  domainId: string;
  personaId: string;
  personaName: string;
  report: EvaluationReport;
}): Promise<IrEvaluation> {
  const { data, error } = await getSupabase()
    .from("ir_evaluations")
    .insert({
      source: input.source,
      msg_num: input.msgNum ?? null,
      company_name: input.companyName ?? null,
      attachment_index: input.attachmentIndex ?? 0,
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
