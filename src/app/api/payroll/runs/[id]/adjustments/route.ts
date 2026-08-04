import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, handleApiError, AuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import { nairaToKobo } from "@/lib/money";
import {
  recalculatePayrollRun,
  PayrollRunError,
} from "@/lib/payroll/run-service";
import { serializeBigInts } from "@/lib/payroll/config-mapper";
import { z } from "zod";

const adjustmentSchema = z.object({
  employeeId: z.string(),
  type: z.enum([
    "BONUS",
    "LOAN_DEDUCTION",
    "ADVANCE",
    "UNPAID_LEAVE",
    "ATTENDANCE_PENALTY",
  ]),
  amount: z.number().positive(),
  description: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    if (!can(session.user.role, "runPayroll")) {
      throw new AuthError("Forbidden", 403);
    }

    const body = adjustmentSchema.parse(await req.json());

    const run = await prisma.payrollRun.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (run.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Adjustments only allowed on draft payroll runs" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: body.employeeId,
        companyId: session.user.companyId,
        status: "ACTIVE",
      },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found or not active" },
        { status: 404 }
      );
    }

    const signedAmount =
      body.type === "BONUS"
        ? Math.abs(body.amount)
        : -Math.abs(body.amount);

    const adjustment = await prisma.payrollAdjustment.create({
      data: {
        payrollRunId: run.id,
        employeeId: body.employeeId,
        type: body.type,
        amountKobo: nairaToKobo(signedAmount),
        description: body.description,
      },
    });

    await recalculatePayrollRun(run.id, session.user.companyId, {
      employeeId: body.employeeId,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "ADD_ADJUSTMENT",
        entityType: "PayrollAdjustment",
        entityId: adjustment.id,
        performedById: session.user.id,
        changes: {
          payrollRunId: run.id,
          employeeId: body.employeeId,
          type: body.type,
          amount: body.amount,
        },
      },
    });

    return NextResponse.json(serializeBigInts(adjustment), { status: 201 });
  } catch (error) {
    if (error instanceof PayrollRunError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
