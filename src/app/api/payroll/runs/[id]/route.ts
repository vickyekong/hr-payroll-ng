import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission, handleApiError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import {
  reverseAndRegeneratePayrollRun,
  PayrollRunError,
} from "@/lib/payroll/run-service";
import { serializeBigInts } from "@/lib/payroll/config-mapper";
import { notifyPayrollSubmitted } from "@/lib/notifications";
import { getPayrollPreflight } from "@/lib/payroll/preflight";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["submit_review", "approve", "reject", "mark_paid", "reverse"]),
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

    return NextResponse.json(serializeBigInts(run));
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
      return NextResponse.json(serializeBigInts(updated));
    }

    let update: {
      status?: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "PAID";
      approvedById?: string | null;
      approvedAt?: Date | null;
      paidAt?: Date | null;
    } = {};
    let notificationResult: Awaited<
      ReturnType<typeof notifyPayrollSubmitted>
    > | null = null;

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
        const preflight = await getPayrollPreflight(
          session.user.companyId,
          run.id
        );
        if (!preflight.canSubmit) {
          return NextResponse.json(
            {
              error:
                "Pre-flight blocked submit. Fix blockers before sending to Super Admin for approval.",
              preflight,
            },
            { status: 422 }
          );
        }
        update = { status: "UNDER_REVIEW" };
        notificationResult = await notifyPayrollSubmitted({
          companyId: session.user.companyId,
          runId: run.id,
          periodMonth: run.periodMonth,
          periodYear: run.periodYear,
          submittedByName: session.user.name,
          excludeUserId: session.user.id,
        });
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

      case "reject":
        await requirePermission("approvePayroll");
        if (run.status !== "UNDER_REVIEW") {
          return NextResponse.json(
            { error: "Can only reject runs under review" },
            { status: 400 }
          );
        }
        update = {
          status: "DRAFT",
          approvedById: null,
          approvedAt: null,
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

    if (body.action === "approve" || body.action === "reject") {
      await prisma.notification.updateMany({
        where: {
          entityType: "PayrollRun",
          entityId: run.id,
          type: "PAYROLL_REVIEW",
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    }

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
          notified: notificationResult?.recipients.map((r) => ({
            email: r.email,
            role: r.role,
            notificationId: r.notificationId,
          })),
          reviewUrl: notificationResult?.linkUrl,
        },
      },
    });

    return NextResponse.json(
      serializeBigInts({
        ...updated,
        notification: notificationResult
          ? {
              reviewUrl: notificationResult.linkUrl,
              periodLabel: notificationResult.periodLabel,
              recipients: notificationResult.recipients.map((r) => ({
                name: r.name,
                email: r.email,
                role: r.role,
              })),
            }
          : null,
      })
    );
  } catch (error) {
    if (error instanceof PayrollRunError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
