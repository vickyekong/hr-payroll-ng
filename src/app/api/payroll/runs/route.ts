import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  recalculatePayrollRun,
  PayrollRunError,
} from "@/lib/payroll/run-service";
import { syncAttendanceIntoPayroll } from "@/lib/attendance/service";
import { getPayrollPreflight } from "@/lib/payroll/preflight";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const createSchema = z.object({
  periodMonth: z.number().min(1).max(12),
  periodYear: z.number().min(2020),
  notes: z.string().optional(),
  /** Default false — attendance deductions require explicit HR sync/confirm. */
  applyAttendancePenalties: z.boolean().optional().default(false),
});

export async function GET() {
  try {
    const session = await requirePermission("runPayroll");
    const runs = await prisma.payrollRun.findMany({
      where: { companyId: session.user.companyId },
      include: {
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        _count: { select: { payslips: true } },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
    return NextResponse.json(runs);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("runPayroll");
    const body = createSchema.parse(await req.json());

    const existing = await prisma.payrollRun.findUnique({
      where: {
        companyId_periodMonth_periodYear: {
          companyId: session.user.companyId,
          periodMonth: body.periodMonth,
          periodYear: body.periodYear,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Payroll run already exists for this period" },
        { status: 409 }
      );
    }

    const run = await prisma.payrollRun.create({
      data: {
        companyId: session.user.companyId,
        periodMonth: body.periodMonth,
        periodYear: body.periodYear,
        status: "DRAFT",
        createdById: session.user.id,
        notes: body.notes,
      },
    });

    let result = await recalculatePayrollRun(run.id, session.user.companyId);

    let penalties: Awaited<
      ReturnType<typeof syncAttendanceIntoPayroll>
    >["penalties"] | null = null;
    let compiled: Awaited<
      ReturnType<typeof syncAttendanceIntoPayroll>
    >["compiled"] | null = null;
    if (body.applyAttendancePenalties) {
      try {
        const sync = await syncAttendanceIntoPayroll({
          companyId: session.user.companyId,
          payrollRunId: run.id,
        });
        compiled = sync.compiled;
        penalties = sync.penalties;
        result = await recalculatePayrollRun(run.id, session.user.companyId);
      } catch (err) {
        console.error("Attendance sync on payroll create skipped:", err);
        penalties = null;
      }
    }

    const preflight = await getPayrollPreflight(
      session.user.companyId,
      run.id
    );

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "CREATE",
        entityType: "PayrollRun",
        entityId: run.id,
        performedById: session.user.id,
        changes: {
          periodMonth: body.periodMonth,
          periodYear: body.periodYear,
          employeeCount: result.employeeCount,
          applyAttendancePenalties: body.applyAttendancePenalties,
          employeesPenalized: penalties?.employeesPenalized ?? 0,
          missedShiftDays: penalties?.missedShiftDays ?? 0,
          daysCompiled: compiled?.daysCompiled ?? 0,
          preflightBlockers: preflight.blockers,
          preflightWarnings: preflight.warnings,
        },
      },
    });

    return NextResponse.json(
      {
        ...run,
        employeeCount: result.employeeCount,
        attendancePenalties: penalties,
        attendanceCompiled: compiled,
        preflight,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PayrollRunError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
