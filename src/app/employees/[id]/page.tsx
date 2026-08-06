import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Badge, employeeStatusVariant } from "@/components/ui/badge";
import { formatCurrency, employeeFullName, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  employeeSexLabel,
  employeeStatusLabel,
} from "@/lib/employees/status";
import { EmployeeLifecyclePanel } from "@/components/employees/lifecycle-panel";

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const employee = await prisma.employee.findFirst({
    where: { id: params.id, companyId: session!.user.companyId },
    include: { leaveBalances: true },
  });

  if (!employee) notFound();

  const gross =
    employee.basicSalaryKobo +
    employee.housingAllowanceKobo +
    employee.transportAllowanceKobo +
    employee.otherTaxableAllowancesKobo;

  return (
    <AppShell>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm text-stone-500">{employee.employeeCode}</p>
          <h1 className="text-2xl font-semibold text-stone-900">
            {employeeFullName(employee.firstName, employee.lastName)}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {employee.jobTitle} · {employee.department}
            {employee.sex ? ` · ${employeeSexLabel(employee.sex)}` : ""}
          </p>
        </div>
        <Badge variant={employeeStatusVariant(employee.status)}>
          {employeeStatusLabel(employee.status)}
        </Badge>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/employees/${employee.id}/edit`}>Edit employee</Link>
        </Button>
      </div>

      <div className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-stone-900">
          Onboarding &amp; offboarding
        </h2>
        <p className="mb-3 text-sm text-stone-500">
          HR checklists for this staff member — start, track, and complete tasks
          on their behalf
        </p>
        <EmployeeLifecyclePanel employeeId={employee.id} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compensation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Basic salary", employee.basicSalaryKobo],
              ["Housing allowance", employee.housingAllowanceKobo],
              ["Transport allowance", employee.transportAllowanceKobo],
              ["Other taxable", employee.otherTaxableAllowancesKobo],
            ].map(([label, amount]) => (
              <div key={label as string} className="flex justify-between">
                <span className="text-stone-500">{label}</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(amount as bigint)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-100 pt-2 font-medium">
              <span>Monthly gross</span>
              <span className="tabular-nums">{formatCurrency(gross)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statutory & bank</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">TIN</span>
              <span>{employee.tin ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">RSA PIN</span>
              <span>{employee.rsaPin ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">NHF number</span>
              <span>{employee.nhfNumber ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Bank</span>
              <span>
                {employee.bankName
                  ? `${employee.bankName} · ${employee.bankAccountNumber}`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Start date</span>
              <span>{formatDate(employee.startDate)}</span>
            </div>
          </CardContent>
        </Card>

        {employee.leaveBalances.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Leave balances ({new Date().getFullYear()})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {employee.leaveBalances.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-md border border-stone-100 px-4 py-3 text-sm"
                  >
                    <p className="text-stone-500">{b.leaveType.replace("_", " ")}</p>
                    <p className="mt-1 font-medium tabular-nums">
                      {b.entitledDays - b.usedDays} / {b.entitledDays} days left
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
