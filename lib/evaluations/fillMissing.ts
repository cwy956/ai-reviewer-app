import { evaluateInvestment } from "../evaluate";
import { getDomain } from "../domains";
import { getPersona } from "../personas";
import { downloadSubmissionFile } from "../irUploads";
import { parsePdf } from "../parsePdf";
import { listPlatformSubmissionSummaries, getEvaluationById, updateInvestmentAttractiveness } from "./store";

/**
 * 플랫폼 제출은 기업에게 먼저 응답한 뒤 백그라운드로 투자 매력도를 계산하는데, 서버가 중간에 끊기면 이 계산만 빠질 수 있음.
 * 심사역 화면은 메일 건과 똑같이 투자 매력도까지 있어야 하므로, 하루 한 번 도는 크론에서 빠진 건을 찾아 채워 줌.
 * 한 번에 최대 `max`건(건당 약 1~1.5분)만 처리 — 크론의 실행 시간 한도를 넘기지 않으려는 안전장치.
 */
export async function fillMissingPlatformInvestment(max = 2): Promise<{ filled: number[]; failed: number[] }> {
  const filled: number[] = [];
  const failed: number[] = [];
  const submissions = await listPlatformSubmissionSummaries();
  const missing = submissions.filter((s) => s.investmentAttractivenessScore == null && s.investmentVerdict == null).reverse(); // 오래된 것부터

  for (const s of missing.slice(0, max)) {
    try {
      const evaluation = await getEvaluationById(s.id);
      const domain = evaluation && getDomain(evaluation.domainId);
      const persona = evaluation && (await getPersona(evaluation.personaId));
      const file = await downloadSubmissionFile(s.id);
      if (!evaluation || evaluation.report.investmentAttractiveness || !domain || !persona || !file) continue;
      const parsed = await parsePdf(file);
      const ia = await evaluateInvestment(persona, domain, parsed.markedText, {});
      if (ia) {
        await updateInvestmentAttractiveness(s.id, ia);
        filled.push(s.id);
      } else failed.push(s.id);
    } catch (err) {
      console.error(`[fill-missing] 제출 #${s.id} 투자 매력도 보강 실패:`, err);
      failed.push(s.id);
    }
  }
  return { filled, failed };
}
