import type { ActionItem } from "@/lib/reportSchema";

const PRIORITY_STYLES: Record<ActionItem["priority"], string> = {
  높음: "bg-bad/20 text-bad",
  중간: "bg-warn/20 text-warn",
  낮음: "bg-white/10 text-muted",
};

export function ActionPlanList({ actionPlan }: { actionPlan: ActionItem[] }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5">
      <h3 className="font-semibold">Action Plan</h3>
      <p className="mb-4 text-xs text-muted">점수 향상을 위한 다음 단계 · 우선순위순</p>
      <ul className="space-y-3">
        {actionPlan.map((item, i) => (
          <li key={i} className="rounded-md border border-panel-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{item.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLES[item.priority]}`}>
                {item.priority}
              </span>
              {item.pageRefs?.map((p) => (
                <span key={p} className="rounded border border-panel-border px-1.5 py-0.5 text-[10px] text-muted">
                  p.{String(p).padStart(2, "0")}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-sm text-muted">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
