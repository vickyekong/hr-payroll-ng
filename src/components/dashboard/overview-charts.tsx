"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartSlice } from "@/lib/dashboard/overview";

const COLORS = [
  "#44403c",
  "#a8a29e",
  "#d97706",
  "#0f766e",
  "#b91c1c",
  "#1d4ed8",
  "#7c2d12",
  "#365314",
];

function ChartCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: ChartSlice[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>
        )}
      </div>
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-stone-500">No data yet</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.key}
                    fill={COLORS[index % COLORS.length]}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  const pct = total ? Math.round((n / total) * 100) : 0;
                  return [`${n} (${pct}%)`, "Staff"];
                }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e7e5e4",
                  fontSize: 12,
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function OverviewCharts({
  byStatus,
  byDepartment,
  bySex,
}: {
  byStatus: ChartSlice[];
  byDepartment: ChartSlice[];
  bySex: ChartSlice[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard
        title="Staff by status"
        subtitle="Active, leave, suspended, and exits"
        data={byStatus}
      />
      <ChartCard
        title="Staff by department"
        subtitle="Headcount distribution"
        data={byDepartment}
      />
      <ChartCard title="Staff by sex" subtitle="Workforce mix" data={bySex} />
    </div>
  );
}
