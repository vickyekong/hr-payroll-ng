import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission, handleApiError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import {
  reverseAndRegeneratePayrollRun,
  PayrollRunError,
} from "@/lib/payroll/run-service";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["submit_review", "approve", "mark_paid", "reverse"]),
  reason: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const run = await prisma.payrollRun.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                department: true,
              },
            },
          },
        },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        adjustments: {
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeCode: true,
              },
            },
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (session.user.role === "EMPLOYEE" && session.user.employeeId) {
      run.payslips = run.payslips.filter(
        (p) => p.employeeId === session.user.employeeId
      );
    } else if (
      !can(session.user.role, "runPayroll") &&
      !can(session.user.role, "approvePayroll")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(run);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const body = actionSchema.parse(await req.json());

    const run = await prisma.payrollRun.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (run.status === "APPROVED" || run.status === "PAID") {
      if (body.action !== "reverse") {
        return NextResponse.json(
          {
            error:
              "Approved payroll runs are immutable. Use reverse and re-run.",
          },
          { status: 400 }
        );
      }
    }

    if (body.action === "reverse") {
      if (
        !can(session.user.role, "runPayroll") &&
        !can(session.user.role, "approvePayroll")
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const result = await reverseAndRegeneratePayrollRun(
        run.id,
        session.user.companyId
      );

      await prisma.auditLog.create({
        data: {
          companyId: session.user.companyId,
          action: "REVERSE",
          entityType: "PayrollRun",
          entityId: run.id,
          performedById: session.user.id,
          changes: {
            action: body.action,
            reason: body.reason,
            from: run.status,
            to: "DRAFT",
            employeeCount: result.employeeCount,
          },
        },
      });

      const updated = await prisma.payrollRun.findUnique({
        where: { id: run.id },
      });
      return NextResponse.json(updated);
    }

    let update: {
      status?: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "PAID";
      approvedById?: string | null;
      approvedAt?: Date | null;
      paidAt?: Date | null;
    } = {};

    switch (body.action) {
      case "submit_review":
        if (!can(session.user.role, "runPayroll")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (run.status !== "DRAFT") {
          return NextResponse.json(
            { error: "Can only submit draft runs" },
            { status: 400 }
          );
        }
        if (
          (await prisma.payslip.count({ where: { payrollRunId: run.id } })) ===
          0
        ) {
          return NextResponse.json(
            { error: "Cannot submit an empty payroll run. Recalculate first." },
            { status: 400 }
          );
        }
        update = { status: "UNDER_REVIEW" };
        break;

      case "approve":
        await requirePermission("approvePayroll");
        if (run.status !== "UNDER_REVIEW") {
          return NextResponse.json(
            { error: "Can only approve runs under review" },
            { status: 400 }
          );
        }
        update = {
          status: "APPROVED",
          approvedById: session.user.id,
          approvedAt: new Date(),
        };
        break;

      case "mark_paid":
        await requirePermission("approvePayroll");
        if (run.status !== "APPROVED") {
          return NextResponse.json(
            { error: "Can only mark approved runs as paid" },
            { status: 400 }
          );
        }
        update = { status: "PAID", paidAt: new Date() };
        break;
    }

    const updated = await prisma.payrollRun.update({
      where: { id: run.id },
      data: update,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: body.action.toUpperCase(),
        entityType: "PayrollRun",
        entityId: run.id,
        performedById: session.user.id,
        changes: {
          action: body.action,
          reason: body.reason,
          from: run.status,
          to: update.status,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof PayrollRunError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
