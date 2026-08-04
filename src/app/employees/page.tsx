import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExportActions } from "@/components/exports/export-actions";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { EmployeesTable } from "@/components/employees/employees-table";
import { serializeBigInts } from "@/lib/payroll/config-mapper";

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions);
  const companyId = session!.user.companyId;
  const [employees, driveStatus] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId },
      orderBy: { employeeCode: "asc" },
    }),
    getGoogleDriveStatus(companyId),
  ]);

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
            {employees.length} records · change status or sex inline in the table
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportActions kind="staff" driveConnected={driveStatus.connected} />
          <Button asChild>
            <Link href="/employees/new">Add employee</Link>
          </Button>
        </div>
      </div>

      <EmployeesTable employees={tableRows} />
    </AppShell>
  );
}
