import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { applyAttendancePenaltiesToPayroll } from "@/lib/attendance/service";
import { recalculatePayrollRun } from "@/lib/payroll/run-service";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  payrollRunId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("runPayroll");
    const body = bodySchema.parse(await req.json());

    const result = await applyAttendancePenaltiesToPayroll({
      companyId: session.user.companyId,
      payrollRunId: body.payrollRunId,
    });

    await recalculatePayrollRun(body.payrollRunId, session.user.companyId);

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "APPLY_ATTENDANCE_PENALTIES",
        entityType: "PayrollRun",
        entityId: body.payrollRunId,
        performedById: session.user.id,
        changes: {
          employeesPenalized: result.employeesPenalized,
          missedShiftDays: result.missedShiftDays,
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
