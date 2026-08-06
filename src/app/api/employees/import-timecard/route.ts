import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { z } from "zod";

const rowSchema = z.object({
  clockDeviceId: z.string().min(1),
  firstName: z.string().min(1),
  department: z.string().min(1),
});

const bodySchema = z.object({
  staff: z.array(rowSchema).min(1).max(500),
});

/**
 * Bulk-import clock Time Card staff (device id + single name + department).
 * Super Admin / HR with manageEmployees. Salary left at 0 for HR to complete.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const { staff } = bodySchema.parse(await req.json());
    const companyId = session.user.companyId;

    const deptNames = [...new Set(staff.map((r) => r.department.trim()))];
    for (const name of deptNames) {
      await prisma.department.upsert({
        where: { companyId_name: { companyId, name } },
        update: {},
        create: { companyId, name },
      });
    }

    let created = 0;
    let updated = 0;
    const results: Array<{ employeeCode: string; action: string }> = [];

    for (const row of staff) {
      const employeeCode = row.clockDeviceId.trim();
      const firstName = row.firstName.trim();
      const lastName = firstName;
      const department = row.department.trim();
      const jobTitle = department;

      const existing = await prisma.employee.findUnique({
        where: {
          companyId_employeeCode: { companyId, employeeCode },
        },
      });

      if (existing) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: {
            firstName,
            lastName,
            department,
            jobTitle,
            clockDeviceId: row.clockDeviceId.trim(),
            status: "ACTIVE",
          },
        });
        updated += 1;
        results.push({ employeeCode, action: "updated" });
      } else {
        const employee = await prisma.employee.create({
          data: {
            companyId,
            employeeCode,
            firstName,
            lastName,
            department,
            jobTitle,
            employmentType: "FULL_TIME",
            status: "ACTIVE",
            startDate: new Date("2026-07-01"),
            clockDeviceId: row.clockDeviceId.trim(),
            basicSalaryKobo: 0n,
            housingAllowanceKobo: 0n,
            transportAllowanceKobo: 0n,
          },
        });

        await prisma.leaveBalance.upsert({
          where: {
            employeeId_leaveType_year: {
              employeeId: employee.id,
              leaveType: "ANNUAL",
              year: 2026,
            },
          },
          update: {},
          create: {
            employeeId: employee.id,
            leaveType: "ANNUAL",
            year: 2026,
            entitledDays: 21,
            usedDays: 0,
          },
        });
        created += 1;
        results.push({ employeeCode, action: "created" });
      }
    }

    await prisma.auditLog.create({
      data: {
        companyId,
        action: "IMPORT_TIMECARD_STAFF",
        entityType: "Employee",
        entityId: companyId,
        performedById: session.user.id,
        changes: { created, updated, total: staff.length, departments: deptNames },
      },
    });

    return NextResponse.json({ created, updated, total: staff.length, results });
  } catch (error) {
    return handleApiError(error);
  }
}
