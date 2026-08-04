import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCurrency,
} from "@/components/ui/table";
import { Badge, employeeStatusVariant } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { employeeFullName } from "@/lib/utils";
import { ExportActions } from "@/components/exports/export-actions";
import { getGoogleDriveStatus } from "@/lib/google-drive";

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

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Employees</h1>
          <p className="mt-1 text-sm text-stone-500">
            {employees.length} records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportActions kind="staff" driveConnected={driveStatus.connected} />
          <Button asChild>
            <Link href="/employees/new">Add employee</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Gross (monthly)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => {
              const gross =
                emp.basicSalaryKobo +
                emp.housingAllowanceKobo +
                emp.transportAllowanceKobo +
                emp.otherTaxableAllowancesKobo;
              return (
                <TableRow key={emp.id}>
                  <TableCell>
                    <Link
                      href={`/employees/${emp.id}`}
                      className="font-medium text-stone-900 hover:underline"
                    >
                      {emp.employeeCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {employeeFullName(emp.firstName, emp.lastName)}
                  </TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell>
                    <Badge variant={employeeStatusVariant(emp.status)}>
                      {emp.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TableCurrency value={gross} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
