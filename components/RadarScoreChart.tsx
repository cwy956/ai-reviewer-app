"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { CategoryScore } from "@/lib/reportSchema";

export function RadarScoreChart({
  categoryScores,
}: {
  categoryScores: CategoryScore[];
}) {
  const data = categoryScores.map((c) => ({
    subject: c.categoryLabel,
    score: c.score,
  }));

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">영역별 자료 충실도</h3>
        <span className="text-xs text-muted">
          항목별로 IR에 필요한 정보가 담긴 정도 · 100점 만점
        </span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke="var(--panel-border)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "var(--muted)", fontSize: 10 }}
            />
            <Radar
              dataKey="score"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.35}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
