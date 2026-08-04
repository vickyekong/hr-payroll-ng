import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExportActions } from "@/components/exports/export-actions";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { EmployeesPageClient } from "@/components/employees/employees-page-client";
import { serializeBigInts } from "@/lib/payroll/config-mapper";

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId;
  const [employees, driveStatus, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId },
      orderBy: { employeeCode: "asc" },
    }),
    getGoogleDriveStatus(companyId),
    prisma.department.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Ensure departments exist for any free-text values already on employees.
  const existingNames = new Set(departments.map((d) => d.name));
  const missing = Array.from(
    new Set(employees.map((e) => e.department).filter(Boolean))
  ).filter((name) => !existingNames.has(name));

  if (missing.length > 0) {
    await prisma.department.createMany({
      data: missing.map((name) => ({ companyId, name })),
      skipDuplicates: true,
    });
  }

  const allDepartments =
    missing.length === 0
      ? departments
      : await prisma.department.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        });

  const tableRows = serializeBigInts(employees).map((emp) => ({
    id: emp.id,
    employeeCode: emp.employeeCode,
    firstName: emp.firstName,
    lastName: emp.lastName,
    department: emp.department,
    status: emp.status,
    sex: emp.sex,
    basicSalaryKobo: emp.basicSalaryKobo,
    housingAllowanceKobo: emp.housingAllowanceKobo,
    transportAllowanceKobo: emp.transportAllowanceKobo,
    otherTaxableAllowancesKobo: emp.otherTaxableAllowancesKobo,
  }));

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Employees</h1>
          <p className="mt-1 text-sm text-stone-500">
            {employees.length} records · edit sex, department, and status in the
            table
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportActions kind="staff" driveConnected={driveStatus.connected} />
          <Button asChild>
            <Link href="/employees/new">Add employee</Link>
          </Button>
        </div>
      </div>

      <EmployeesPageClient
        employees={tableRows}
        initialDepartments={allDepartments}
      />
    </AppShell>
  );
}
