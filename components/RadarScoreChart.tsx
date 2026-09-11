"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import type { CategoryScore } from "@/lib/reportSchema";

export function RadarScoreChart({ categoryScores }: { categoryScores: CategoryScore[] }) {
  const data = categoryScores.map((c) => ({ subject: c.categoryLabel, score: c.score }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="var(--panel-border)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--foreground)", fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 10 }} />
          <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
