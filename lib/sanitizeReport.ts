import type { EvaluationReport } from "./reportSchema";

/**
 * 리포트 문구 정리 — "실명 대기업", "실명 고객 명시" 같은 군더더기 표현에서 "실명"을 제거.
 * 프롬프트로 금지해도 모델이 가끔 쓰고, 이미 저장된 평가에도 남아 있어서 생성 직후와 화면 표시 직전 양쪽에서 적용.
 * JSON 문자열 전체에 정규식을 쓰지만 줄바꿈은 \\n(백슬래시+n)로 직렬화돼 있어 \\s가 건드리지 않음.
 */
export function sanitizeReport<T extends EvaluationReport>(report: T): T {
  const json = JSON.stringify(report);
  if (!json.includes("실명")) return report;
  return JSON.parse(json.replace(/실명\s*/g, "")) as T;
}
