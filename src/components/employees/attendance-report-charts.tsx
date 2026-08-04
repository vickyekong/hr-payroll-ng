"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

export type AttendanceChartSlice = {
  key: string;
  name: string;
  value: number;
};

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

function MiniPie({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: AttendanceChartSlice[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500">No data yet</p>
      ) : (
        <div className="mt-2 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                innerRadius={42}
                outerRadius={72}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.key}
                    fill={COLORS[index % COLORS.length]}
                    stroke="#fff"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  const pct = total ? Math.round((n / total) * 100) : 0;
                  return [`${n} (${pct}%)`, ""];
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

export function AttendanceReportCharts({
  byStatus,
  byStaffOutcome,
  byDepartmentAbsent,
}: {
  byStatus: AttendanceChartSlice[];
  byStaffOutcome: AttendanceChartSlice[];
  byDepartmentAbsent: AttendanceChartSlice[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MiniPie
        title="Attendance by day status"
        subtitle="All compiled workdays this month"
        data={byStatus}
      />
      <MiniPie
        title="Staff outcome"
        subtitle="How each person performed"
        data={byStaffOutcome}
      />
      <MiniPie
        title="Missed shifts by department"
        subtitle="Absent day counts"
        data={byDepartmentAbsent}
      />
    </div>
  );
}
