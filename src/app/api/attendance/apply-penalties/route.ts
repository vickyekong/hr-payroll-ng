import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { syncAttendanceIntoPayroll } from "@/lib/attendance/service";
import { recalculatePayrollRun } from "@/lib/payroll/run-service";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  payrollRunId: z.string().min(1),
});

/**
 * Compile clock attendance for the payroll month and deduct missed-shift
 * amounts from draft salaries, then recalculate payslips.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("runPayroll");
    const body = bodySchema.parse(await req.json());

    const sync = await syncAttendanceIntoPayroll({
      companyId: session.user.companyId,
      payrollRunId: body.payrollRunId,
    });

    await recalculatePayrollRun(body.payrollRunId, session.user.companyId);

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "SYNC_ATTENDANCE_INTO_PAYROLL",
        entityType: "PayrollRun",
        entityId: body.payrollRunId,
        performedById: session.user.id,
        changes: {
          daysCompiled: sync.compiled.daysCompiled,
          absentCount: sync.compiled.absentCount,
          employeesPenalized: sync.penalties.employeesPenalized,
          missedShiftDays: sync.penalties.missedShiftDays,
          penaltyTotalKobo: sync.penalties.penaltyTotalKobo,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      daysCompiled: sync.compiled.daysCompiled,
      absentCount: sync.compiled.absentCount,
      employeesPenalized: sync.penalties.employeesPenalized,
      missedShiftDays: sync.penalties.missedShiftDays,
      penaltyTotalKobo: sync.penalties.penaltyTotalKobo,
      adjustments: sync.penalties.adjustments,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
