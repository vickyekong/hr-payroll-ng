import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  normalizeClockDeviceId,
  staffCodeFromClockId,
} from "@/lib/employees/staff-code";

/**
 * One-shot: for staff with a clock device ID, set employeeCode to STAFF-{clockId}.
 */
export async function POST() {
  try {
    const session = await requirePermission("manageEmployees");
    const companyId = session.user.companyId;

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        clockDeviceId: { not: null },
      },
      select: { id: true, employeeCode: true, clockDeviceId: true },
    });

    let updated = 0;
    let skipped = 0;
    const changes: Array<{ from: string; to: string }> = [];

    for (const emp of employees) {
      if (!emp.clockDeviceId) continue;
      const clockId = normalizeClockDeviceId(emp.clockDeviceId);
      const nextCode = staffCodeFromClockId(clockId);
      if (emp.employeeCode === nextCode && emp.clockDeviceId === clockId) {
        skipped += 1;
        continue;
      }

      // Avoid unique clashes if somehow another row already has the target code
      const clash = await prisma.employee.findUnique({
        where: {
          companyId_employeeCode: { companyId, employeeCode: nextCode },
        },
      });
      if (clash && clash.id !== emp.id) {
        skipped += 1;
        continue;
      }

      await prisma.employee.update({
        where: { id: emp.id },
        data: {
          employeeCode: nextCode,
          clockDeviceId: clockId,
        },
      });
      changes.push({ from: emp.employeeCode, to: nextCode });
      updated += 1;
    }

    await prisma.auditLog.create({
      data: {
        companyId,
        action: "RENUMBER_STAFF_CODES",
        entityType: "Employee",
        entityId: companyId,
        performedById: session.user.id,
        changes: { updated, skipped, sample: changes.slice(0, 30) },
      },
    });

    return NextResponse.json({ updated, skipped, total: employees.length, changes });
  } catch (error) {
    return handleApiError(error);
  }
}
