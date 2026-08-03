import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, handleApiError, AuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import {
  recalculatePayrollRun,
  PayrollRunError,
} from "@/lib/payroll/run-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; adjustmentId: string } }
) {
  try {
    const session = await requireAuth();
    if (!can(session.user.role, "runPayroll")) {
      throw new AuthError("Forbidden", 403);
    }

    const adjustment = await prisma.payrollAdjustment.findFirst({
      where: {
        id: params.adjustmentId,
        payrollRunId: params.id,
        payrollRun: { companyId: session.user.companyId },
      },
    });

    if (!adjustment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const run = await prisma.payrollRun.findUnique({
      where: { id: params.id },
    });
    if (run?.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only delete adjustments on draft runs" },
        { status: 400 }
      );
    }

    await prisma.payrollAdjustment.delete({ where: { id: adjustment.id } });

    await recalculatePayrollRun(run.id, session.user.companyId, {
      employeeId: adjustment.employeeId,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "DELETE_ADJUSTMENT",
        entityType: "PayrollAdjustment",
        entityId: adjustment.id,
        performedById: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PayrollRunError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
