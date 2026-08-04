import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { Badge, payrollStatusVariant } from "@/components/ui/badge";
import { OverviewCharts } from "@/components/dashboard/overview-charts";
import { PeopleIntelligencePanel } from "@/components/dashboard/people-intelligence";
import { getOverviewData } from "@/lib/dashboard/overview";
import { getStaffIntelligence } from "@/lib/intelligence/staff-insights";
import { formatCurrency, getMonthName } from "@/lib/utils";
import { employeeStatusLabel } from "@/lib/employees/status";

export const dynamic = "force-dynamic";

function Kpi({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition hover:border-stone-300">
        {content}
      </Link>
    );
  }
  return content;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const companyId = session.user.companyId;
  const [data, intelligence] = await Promise.all([
    getOverviewData(companyId),
    getStaffIntelligence(companyId),
  ]);
  const { kpis, charts, recentRuns, latestPaidRun } = data;

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Overview</h1>
        <p className="mt-1 text-sm text-stone-500">
          Intelligent glance report — stats, insights, and actions from your HR
          data
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Kpi
          label="Total staff"
          value={kpis.totalStaff}
          hint={`${kpis.activeStaff} active`}
          href="/employees"
        />
        <Kpi
          label="Departments"
          value={kpis.departments}
          href="/employees"
        />
        <Kpi
          label="Awaiting approval"
          value={kpis.pendingApprovals}
          hint="Payroll under review"
          href="/payroll"
        />
        <Kpi
          label="Draft payroll"
          value={kpis.draftRuns}
          href="/payroll"
        />
        <Kpi
          label="Pending leave"
          value={kpis.pendingLeave}
          href="/leave"
        />
        <Kpi
          label="HR Desk inbox"
          value={kpis.pendingHrDesk}
          hint="Mail to triage"
          href="/hr-desk"
        />
        <Kpi
          label="Attendance rate"
          value={
            intelligence.stats.avgAttendanceRate == null
              ? "—"
              : `${intelligence.stats.avgAttendanceRate}%`
          }
          hint={`${intelligence.stats.missedShifts} missed shifts`}
          href="/employees?tab=attendance"
        />
        <Kpi
          label="Last net pay"
          value={
            latestPaidRun
              ? formatCurrency(latestPaidRun.totals.net)
              : "—"
          }
          hint={
            latestPaidRun
              ? `${getMonthName(latestPaidRun.periodMonth)} ${latestPaidRun.periodYear}`
              : "No approved run yet"
          }
          href={latestPaidRun ? `/payroll/${latestPaidRun.id}` : "/payroll"}
        />
      </div>

      <PeopleIntelligencePanel
        briefing={intelligence.briefing}
        periodLabel={intelligence.period.label}
        stats={intelligence.stats}
        insights={intelligence.insights}
        watchlist={intelligence.watchlist}
        departmentHealth={intelligence.departmentHealth}
      />

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Staff mix</h2>
            <p className="text-sm text-stone-500">
              Who is on the books — status, department, and sex
            </p>
          </div>
          <Link
            href="/employees"
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            Manage employees →
          </Link>
        </div>
        <OverviewCharts
          byStatus={charts.byStatus}
          byDepartment={charts.byDepartment}
          bySex={charts.bySex}
        />
      </section>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">
                Recent payroll runs
              </h2>
              <p className="text-xs text-stone-500">Latest five periods</p>
            </div>
            <Link
              href="/payroll"
              className="text-xs text-stone-600 hover:text-stone-900"
            >
              All runs →
            </Link>
          </div>
          {recentRuns.length === 0 ? (
            <p className="px-5 py-8 text-sm text-stone-500">
              No payroll runs yet. Create one from Payroll.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {recentRuns.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/payroll/${run.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {getMonthName(run.periodMonth)} {run.periodYear}
                      </p>
                      <p className="text-xs text-stone-500">
                        {run.payslipCount} payslips · {run.createdBy}
                      </p>
                    </div>
                    <Badge variant={payrollStatusVariant(run.status)}>
                      {run.status.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">
                Snapshot &amp; attention
              </h2>
              <p className="text-xs text-stone-500">
                What needs a look right now
              </p>
            </div>
            <Link
              href="/reports"
              className="text-xs text-stone-600 hover:text-stone-900"
            >
              Full reports →
            </Link>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-stone-500">Status mix</p>
                <ul className="mt-1 space-y-0.5">
                  {charts.byStatus.slice(0, 5).map((s) => (
                    <li
                      key={s.key}
                      className="flex justify-between gap-2 tabular-nums"
                    >
                      <span>{s.name}</span>
                      <span className="font-medium">{s.value}</span>
                    </li>
                  ))}
                  {charts.byStatus.length === 0 && (
                    <li className="text-stone-400">No staff</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-stone-500">Employment type</p>
                <ul className="mt-1 space-y-0.5">
                  {charts.byEmploymentType.map((s) => (
                    <li
                      key={s.key}
                      className="flex justify-between gap-2 tabular-nums"
                    >
                      <span>{s.name}</span>
                      <span className="font-medium">{s.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-md border border-stone-100 bg-stone-50 px-3 py-3 text-sm">
              <p className="font-medium text-stone-800">Needs attention</p>
              <ul className="mt-2 space-y-1 text-stone-600">
                <li>
                  {kpis.pendingApprovals > 0 ? (
                    <Link href="/payroll" className="hover:text-stone-900">
                      {kpis.pendingApprovals} payroll run
                      {kpis.pendingApprovals === 1 ? "" : "s"} waiting for
                      accountant / GM →
                    </Link>
                  ) : (
                    "No payroll waiting for approval"
                  )}
                </li>
                <li>
                  {kpis.pendingLeave > 0 ? (
                    <Link href="/leave" className="hover:text-stone-900">
                      {kpis.pendingLeave} leave request
                      {kpis.pendingLeave === 1 ? "" : "s"} to review →
                    </Link>
                  ) : (
                    "No pending leave requests"
                  )}
                </li>
                <li>
                  {kpis.pendingHrDesk > 0 ? (
                    <Link href="/hr-desk" className="hover:text-stone-900">
                      {kpis.pendingHrDesk} HR Desk mail
                      {kpis.pendingHrDesk === 1 ? "" : "s"} awaiting triage →
                    </Link>
                  ) : (
                    "HR Desk inbox is clear"
                  )}
                </li>
                <li>
                  {kpis.draftRuns > 0 ? (
                    <Link href="/payroll" className="hover:text-stone-900">
                      {kpis.draftRuns} draft payroll run
                      {kpis.draftRuns === 1 ? "" : "s"} in progress →
                    </Link>
                  ) : (
                    "No draft payroll runs"
                  )}
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {latestPaidRun && (
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">
                Latest approved payroll
              </h2>
              <p className="text-xs text-stone-500">
                {getMonthName(latestPaidRun.periodMonth)}{" "}
                {latestPaidRun.periodYear} · {latestPaidRun.headcount}{" "}
                employees
              </p>
            </div>
            <Badge variant={payrollStatusVariant(latestPaidRun.status)}>
              {latestPaidRun.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs text-stone-500">Gross</p>
              <p className="mt-1 font-medium tabular-nums">
                {formatCurrency(latestPaidRun.totals.gross)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">PAYE</p>
              <p className="mt-1 font-medium tabular-nums">
                {formatCurrency(latestPaidRun.totals.paye)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Pension</p>
              <p className="mt-1 font-medium tabular-nums">
                {formatCurrency(latestPaidRun.totals.pension)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">NHF</p>
              <p className="mt-1 font-medium tabular-nums">
                {formatCurrency(latestPaidRun.totals.nhf)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Net pay</p>
              <p className="mt-1 font-medium tabular-nums">
                {formatCurrency(latestPaidRun.totals.net)}
              </p>
            </div>
          </div>
          <div className="border-t border-stone-100 px-5 py-3">
            <Link
              href={`/payroll/${latestPaidRun.id}`}
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              Open run →
            </Link>
          </div>
        </section>
      )}

      {!latestPaidRun && charts.byStatus.length > 0 && (
        <p className="text-sm text-stone-500">
          Tip: after your first approved payroll, remittance and net-pay totals
          will appear here. Status labels:{" "}
          {charts.byStatus
            .map((s) => `${employeeStatusLabel(s.key)} ${s.value}`)
            .join(" · ")}
          .
        </p>
      )}
    </AppShell>
  );
}
