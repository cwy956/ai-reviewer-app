"use client";

export function DisclaimerGate({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-panel-border bg-panel p-5">
      <p className="text-sm font-semibold text-muted">면책 고지</p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
        <li>본 평가는 AI 심사역이 IR 자료의 &apos;충실도(근거 기재 정도)&apos;를 분석한 결과입니다.</li>
        <li>사업의 투자 매력도나 투자 권유가 아니며, 점수는 IR 자료가 근거를 얼마나 충실히 담았는가의 평가일 뿐 사업의 매력도가 아닙니다.</li>
        <li>다른 AI 심사역은 다르게 평가할 수 있습니다.</li>
        <li>실제 심사역은 다르게 평가할 수 있습니다.</li>
        <li>투자 결정의 근거로 사용할 수 없습니다.</li>
      </ul>
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-panel-border p-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        />
        <span>
          본 평가가 AI 심사역의 의견이며 <strong className="text-foreground">투자 자문이 아님</strong>을 이해했습니다.
        </span>
      </label>
    </div>
  );
}
