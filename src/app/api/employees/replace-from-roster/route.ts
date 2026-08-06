import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { z } from "zod";
import bundledRoster from "@/data/staff-details-roster.json";

const rowSchema = z.object({
  employeeCode: z.string().min(1).max(40),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(120),
  department: z.string().min(1).max(120),
  jobTitle: z.string().min(1).max(120),
  bankAccountNumber: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
});

const bodySchema = z.object({
  /** When true, load the bundled Staff Details.xlsx roster. */
  useBundledRoster: z.boolean().optional(),
  confirmReplace: z.literal(true),
  staff: z.array(rowSchema).min(1).max(500).optional(),
});

/**
 * Wipe all company employees and recreate from a roster.
 * Keeps Super Admin / HR login users (unlinks any employeeId first).
 * Salaries left at 0 for HR to complete; staff codes are provisional.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = bodySchema.parse(await req.json());
    const companyId = session.user.companyId;

    const staff = body.useBundledRoster
      ? rowSchema.array().parse(bundledRoster.staff)
      : body.staff;

    if (!staff?.length) {
      return NextResponse.json(
        { error: "No staff rows provided" },
        { status: 400 }
      );
    }

    const codes = new Set<string>();
    for (const row of staff) {
      const code = row.employeeCode.trim().toUpperCase();
      if (codes.has(code)) {
        return NextResponse.json(
          { error: `Duplicate employee code: ${code}` },
          { status: 400 }
        );
      }
      codes.add(code);
    }

    const existingCount = await prisma.employee.count({
      where: { companyId },
    });

    // Unlink portal users so employee delete does not fail on User.employeeId
    await prisma.user.updateMany({
      where: { companyId, employeeId: { not: null } },
      data: { employeeId: null },
    });

    // Delete employees (cascades payslips, leave, attendance days, etc.)
    const deleted = await prisma.employee.deleteMany({
      where: { companyId },
    });

    const deptNames = [
      ...new Set(staff.map((r) => r.department.trim()).filter(Boolean)),
    ];
    for (const name of deptNames) {
      await prisma.department.upsert({
        where: { companyId_name: { companyId, name } },
        update: {},
        create: { companyId, name },
      });
    }

    const year = new Date().getFullYear();
    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const created: string[] = [];

    for (const row of staff) {
      const employee = await prisma.employee.create({
        data: {
          companyId,
          employeeCode: row.employeeCode.trim().toUpperCase(),
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          department: row.department.trim(),
          jobTitle: row.jobTitle.trim(),
          employmentType: "FULL_TIME",
          status: "ACTIVE",
          startDate,
          bankName: row.bankName?.trim() || null,
          bankAccountNumber: row.bankAccountNumber?.trim() || null,
          basicSalaryKobo: 0n,
          housingAllowanceKobo: 0n,
          transportAllowanceKobo: 0n,
          clockDeviceId: null,
        },
      });

      await prisma.leaveBalance.create({
        data: {
          employeeId: employee.id,
          leaveType: "ANNUAL",
          year,
          entitledDays: 21,
          usedDays: 0,
        },
      });

      created.push(employee.employeeCode);
    }

    await prisma.auditLog.create({
      data: {
        companyId,
        action: "REPLACE_EMPLOYEE_ROSTER",
        entityType: "Employee",
        entityId: companyId,
        performedById: session.user.id,
        changes: {
          deletedBefore: existingCount,
          deleted: deleted.count,
          created: created.length,
          departments: deptNames.length,
          codesSample: created.slice(0, 5),
        },
      },
    });

    return NextResponse.json({
      ok: true,
      deleted: deleted.count,
      created: created.length,
      departments: deptNames.length,
      employeeCodes: created,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
