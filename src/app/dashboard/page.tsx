import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { Badge, payrollStatusVariant } from "@/components/ui/badge";
import { OverviewCharts } from "@/components/dashboard/overview-charts";
import {
  CommandCenterHero,
  OmniCoPilotStrip,
  QuickWorkflows,
} from "@/components/dashboard/command-center";
import { getCommandCenterData } from "@/lib/dashboard/command-center";
import { getMonthName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const companyId = session.user.companyId;
  const data = await getCommandCenterData(companyId);
  const { overview } = data;
  const { kpis, charts, recentRuns } = overview;

  return (
    <AppShell>
      <CommandCenterHero
        data={data}
        userName={session.user.name ?? "HR Leader"}
      />

      <OmniCoPilotStrip lines={data.coPilot} />

      <QuickWorkflows />

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              Staff mix
            </h2>
            <p className="text-sm text-muted">
              {kpis.totalStaff} staff · {kpis.activeStaff} active ·{" "}
              {kpis.departments} departments
            </p>
          </div>
          <Link
            href="/employees"
            className="text-sm font-medium text-lagoon hover:text-lagoon-deep"
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

      <section className="mb-8 overflow-hidden rounded-xl border border-line/80 bg-foam/95 shadow-soft">
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Recent payroll runs
            </h2>
            <p className="text-xs text-muted">Latest five periods</p>
          </div>
          <Link
            href="/payroll"
            className="text-xs font-medium text-lagoon hover:text-lagoon-deep"
          >
            All runs →
          </Link>
        </div>
        {recentRuns.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">
            No payroll runs yet. Use Run Payroll above to start.
          </p>
        ) : (
          <ul className="divide-y divide-sand">
            {recentRuns.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/payroll/${run.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-mist"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {getMonthName(run.periodMonth)} {run.periodYear}
                    </p>
                    <p className="text-xs text-muted">
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
    </AppShell>
  );
}
