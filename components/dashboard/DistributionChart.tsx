"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DistributionChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={110} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 8 }}
            labelStyle={{ color: "var(--foreground)" }}
            itemStyle={{ color: "var(--accent-soft)" }}
            wrapperStyle={{ transition: "none" }}
            isAnimationActive={false}
            cursor={{ fill: "var(--accent)", fillOpacity: 0.08 }}
          />
          <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
