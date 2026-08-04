import Link from "next/link";
import type {
  DepartmentHealth,
  StaffInsight,
  StaffWatchItem,
} from "@/lib/intelligence/staff-insights";
import { formatCurrency } from "@/lib/utils";

function severityStyles(severity: StaffInsight["severity"]) {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50";
    case "watch":
      return "border-amber-200 bg-amber-50";
    case "good":
      return "border-emerald-200 bg-emerald-50";
    default:
      return "border-stone-200 bg-white";
  }
}

export function PeopleIntelligencePanel({
  briefing,
  periodLabel,
  stats,
  insights,
  watchlist,
  departmentHealth,
}: {
  briefing: string;
  periodLabel: string;
  stats: {
    avgAttendanceRate: number | null;
    missedShifts: number;
    lateOrPartialDays: number;
    attendancePenaltyKobo: string;
    pendingLeave: number;
    hrDeskOpen: number;
    missingClockIds: number;
    missingShifts: number;
    monthlyGrossishWageBillKobo: string;
    approvedLeaveDaysThisMonth: number;
    contractStaff: number;
    activeStaff: number;
  };
  insights: StaffInsight[];
  watchlist: StaffWatchItem[];
  departmentHealth: DepartmentHealth[];
}) {
  return (
    <section className="mb-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            People intelligence
          </h2>
          <p className="text-sm text-stone-500">
            Auto stats and recommendations from staff, attendance, leave,
            payroll, and HR Desk · {periodLabel}
          </p>
        </div>
        <Link
          href="/employees"
          className="text-sm text-stone-600 hover:text-stone-900"
        >
          Open staff directory →
        </Link>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-900 px-5 py-4 text-stone-50">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
          Briefing
        </p>
        <p className="mt-2 text-sm leading-relaxed text-stone-100">{briefing}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Attendance rate
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {stats.avgAttendanceRate == null
              ? "—"
              : `${stats.avgAttendanceRate}%`}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {stats.missedShifts} missed · {stats.lateOrPartialDays} late/partial
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Attendance penalties
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(BigInt(stats.attendancePenaltyKobo || "0"))}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            From compiled missed shifts
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Active wage bill (basic+)
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(BigInt(stats.monthlyGrossishWageBillKobo || "0"))}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {stats.activeStaff} active · {stats.contractStaff} contract
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Leave & inbox
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {stats.pendingLeave + stats.hrDeskOpen}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {stats.approvedLeaveDaysThisMonth} approved leave days this month
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`rounded-lg border px-4 py-3 ${severityStyles(insight.severity)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                  {insight.severity}
                </p>
                <p className="mt-1 text-sm font-semibold text-stone-900">
                  {insight.title}
                </p>
                <p className="mt-1 text-sm text-stone-600">{insight.detail}</p>
                {insight.href && (
                  <Link
                    href={insight.href}
                    className="mt-2 inline-block text-xs font-medium text-stone-800 hover:underline"
                  >
                    Take action →
                  </Link>
                )}
              </div>
              {insight.metric && (
                <p className="shrink-0 text-sm font-semibold tabular-nums text-stone-800">
                  {insight.metric}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-stone-900">
              Staff watchlist
            </h3>
            <p className="text-xs text-stone-500">
              Highest-priority people based on absences, setup gaps, and status
            </p>
          </div>
          {watchlist.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-500">
              No staff flagged right now.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {watchlist.map((person) => (
                <li key={person.employeeId} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/employees/${person.employeeId}`}
                        className="text-sm font-medium text-stone-900 hover:underline"
                      >
                        {person.name}
                      </Link>
                      <p className="text-xs text-stone-500">
                        {person.employeeCode} · {person.department}
                        {person.attendanceRate != null
                          ? ` · ${person.attendanceRate}% attendance`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-stone-600">
                        {person.flags.join(" · ")}
                      </p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-stone-700">
                      {person.score}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-stone-900">
              Department health
            </h3>
            <p className="text-xs text-stone-500">
              Headcount, attendance, and basic wage bill by team
            </p>
          </div>
          {departmentHealth.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-500">No departments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-100 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Department</th>
                    <th className="px-2 py-2 font-medium text-right">Staff</th>
                    <th className="px-2 py-2 font-medium text-right">Absent</th>
                    <th className="px-2 py-2 font-medium text-right">Att%</th>
                    <th className="px-4 py-2 font-medium text-right">Basic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {departmentHealth.map((d) => (
                    <tr key={d.department}>
                      <td className="px-4 py-2 font-medium text-stone-800">
                        {d.department}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {d.active}/{d.headcount}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {d.absentDays}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {d.avgAttendanceRate == null
                          ? "—"
                          : `${d.avgAttendanceRate}%`}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-stone-700">
                        {formatCurrency(BigInt(d.payrollBasicKobo))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
