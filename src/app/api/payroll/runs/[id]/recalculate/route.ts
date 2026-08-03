import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  recalculatePayrollRun,
  PayrollRunError,
} from "@/lib/payroll/run-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("runPayroll");

    const result = await recalculatePayrollRun(
      params.id,
      session.user.companyId
    );

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "RECALCULATE",
        entityType: "PayrollRun",
        entityId: params.id,
        performedById: session.user.id,
        changes: { employeeCount: result.employeeCount },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PayrollRunError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
