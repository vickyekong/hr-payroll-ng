import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Badge, payrollStatusVariant } from "@/components/ui/badge";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId;

  const [employeeCount, activeRuns, latestRun] = await Promise.all([
    prisma.employee.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.payrollRun.count({
      where: { companyId, status: { in: ["DRAFT", "UNDER_REVIEW"] } },
    }),
    prisma.payrollRun.findFirst({
      where: { companyId, status: { in: ["APPROVED", "PAID"] } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: { payslips: true },
    }),
  ]);

  const latestTotals = latestRun?.payslips.reduce(
    (acc, p) => ({
      gross: acc.gross + p.grossPayKobo,
      net: acc.net + p.netPayKobo,
      paye: acc.paye + p.payeKobo,
    }),
    { gross: 0n, net: 0n, paye: 0n }
  );

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Overview</h1>
        <p className="mt-1 text-sm text-stone-500">
          Payroll operations at a glance
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">
              Active Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{employeeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">
              Pending Payroll Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{activeRuns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-stone-500">
              Last Run Net Pay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {latestTotals ? formatCurrency(latestTotals.net) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {latestRun && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Latest Payroll Run</CardTitle>
              <p className="text-sm text-stone-500">
                {latestRun.periodMonth}/{latestRun.periodYear}
              </p>
            </div>
            <Badge variant={payrollStatusVariant(latestRun.status)}>
              {latestRun.status.replace("_", " ")}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-stone-500">Total Gross</p>
                <p className="font-medium tabular-nums">
                  {formatCurrency(latestTotals!.gross)}
                </p>
              </div>
              <div>
                <p className="text-stone-500">Total PAYE</p>
                <p className="font-medium tabular-nums">
                  {formatCurrency(latestTotals!.paye)}
                </p>
              </div>
              <div>
                <p className="text-stone-500">Employees Paid</p>
                <p className="font-medium tabular-nums">
                  {latestRun.payslips.length}
                </p>
              </div>
            </div>
            <Link
              href={`/payroll/${latestRun.id}`}
              className="mt-4 inline-block text-sm text-stone-600 hover:text-stone-900"
            >
              View run →
            </Link>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
