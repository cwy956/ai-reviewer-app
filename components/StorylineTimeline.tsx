import type { StorylineStep } from "@/lib/reportSchema";

export function StorylineTimeline({ storyline }: { storyline: StorylineStep[] }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5">
      <h3 className="font-semibold">스토리 라인 구성</h3>
      <p className="mb-4 text-xs text-muted">이 회사를 효과적으로 소개하기 위한 단계별 흐름</p>
      <ol className="space-y-4">
        {storyline.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent-soft">
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm text-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
