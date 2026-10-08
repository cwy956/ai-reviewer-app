"use client";

export function DisclaimerGate({
  checked,
  onChange,
  privacyChecked,
  onPrivacyChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  privacyChecked: boolean;
  onPrivacyChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-panel-border bg-panel p-5">
      <p className="text-sm font-semibold text-muted">면책 고지</p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
        <li>제출하신 IR은 AI 심사역이 분석해 피드백을 드립니다. 이 피드백은 IR 자료의 &apos;충실도(근거 기재 정도)&apos;를 분석한 결과입니다.</li>
        <li>사업의 투자 매력도나 투자 권유가 아니며, 점수는 IR 자료가 근거를 얼마나 충실히 담았는가의 평가일 뿐 사업의 매력도가 아닙니다.</li>
        <li>다른 AI 심사역은 다르게 평가할 수 있습니다.</li>
        <li>실제 심사역은 다르게 평가할 수 있습니다.</li>
        <li>투자 결정의 근거로 사용할 수 없습니다.</li>
        <li>제출된 자료는 안다아시아벤처스 심사역이 검토하며, 투자 검토를 진행하게 되는 경우에만 별도로 연락드립니다. 모든 제출 건에 회신을 드리지는 않습니다.</li>
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

      <div className="space-y-2 rounded-md border border-panel-border p-3 text-sm">
        <p className="font-semibold text-muted">개인정보 수집·이용 동의 (필수)</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
          <li>수집 항목: 회사명, 담당자 이름, 이메일, 연락처(선택), 남기신 코멘트</li>
          <li>이용 목적: 투자 제안 검토 및 검토 진행 시 연락</li>
          <li>AI 피드백을 만들기 위해 제출하신 IR 자료가 외부 AI 서비스(Anthropic Claude)로 전송되어 분석됩니다.</li>
          <li>제출하신 정보는 안다아시아벤처스 심사역만 열람하며 외부에 공개하지 않습니다.</li>
        </ul>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={privacyChecked}
            onChange={(e) => onPrivacyChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>위 개인정보 수집·이용에 동의합니다.</span>
        </label>
      </div>
    </div>
  );
}
