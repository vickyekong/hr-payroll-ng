import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExportActions } from "@/components/exports/export-actions";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { EmployeesPageClient } from "@/components/employees/employees-page-client";
import { OpenLifecycleQueue } from "@/components/employees/lifecycle-queue";
import { serializeBigInts } from "@/lib/payroll/config-mapper";
import { ensureOrgStructure } from "@/lib/org/ensure-org-structure";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const companyId = session.user.companyId;

  try {
    await ensureOrgStructure(companyId);
  } catch (error) {
    console.error("Org structure ensure skipped:", error);
  }

  const [employees, driveStatus, allDepartments, allJobDescriptions] =
    await Promise.all([
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
      prisma.jobDescription.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const tableRows = serializeBigInts(employees).map((emp) => ({
    id: emp.id,
    employeeCode: emp.employeeCode,
    firstName: emp.firstName,
    lastName: emp.lastName,
    department: emp.department,
    jobTitle: emp.jobTitle,
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
            Staff directory, onboarding / offboarding, and attendance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportActions kind="staff" driveConnected={driveStatus.connected} />
          <Button asChild>
            <Link href="/employees/new">Add employee</Link>
          </Button>
        </div>
      </div>

      <OpenLifecycleQueue />

      <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
        <EmployeesPageClient
          employees={tableRows}
          initialDepartments={allDepartments}
          initialJobDescriptions={allJobDescriptions}
        />
      </Suspense>
    </AppShell>
  );
}
