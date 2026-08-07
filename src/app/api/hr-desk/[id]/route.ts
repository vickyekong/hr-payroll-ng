import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { createHrDecisionDraft } from "@/lib/hr-desk/service";
import { serializeBigInts } from "@/lib/payroll/config-mapper";
import { ensureHrDeskSchema } from "@/lib/ensure-hr-desk-schema";
import { z } from "zod";

const patchSchema = z.object({
  employeeId: z.string().nullable().optional(),
  assigneeUserId: z.string().nullable().optional(),
  category: z
    .enum(["LEAVE", "RESIGNATION", "COMPLAINT", "INQUIRY", "PAYROLL", "GENERAL"])
    .optional(),
  status: z
    .enum(["NEW", "TRIAGED", "ASSIGNED", "APPROVED", "REJECTED", "CLOSED"])
    .optional(),
  notes: z.string().optional(),
  templateId: z
    .enum([
      "standard_approve",
      "standard_reject",
      "need_more_info",
      "acknowledge",
      "closed_no_action",
    ])
    .optional(),
  action: z.enum(["approve", "reject"]).optional(),
});

const messageInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      department: true,
    },
  },
  assigneeUser: {
    select: { id: true, name: true, email: true, role: true },
  },
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageHrDesk");
    await ensureHrDeskSchema();
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.hrDeskMessage.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.action) {
      const result = await createHrDecisionDraft({
        companyId: session.user.companyId,
        messageId: params.id,
        decision: body.action,
        notes: body.notes,
        templateId: body.templateId,
        performedById: session.user.id,
      });

      await prisma.auditLog.create({
        data: {
          companyId: session.user.companyId,
          action: body.action.toUpperCase(),
          entityType: "HrDeskMessage",
          entityId: params.id,
          performedById: session.user.id,
          changes: {
            draftId: result.draftId,
            leaveRequestId: result.message.leaveRequestId,
            templateId: body.templateId ?? null,
          },
        },
      });

      const refreshed = await prisma.hrDeskMessage.findFirst({
        where: { id: params.id },
        include: messageInclude,
      });

      return NextResponse.json(
        serializeBigInts({
          ...(refreshed ?? result.message),
          draftPreview: result.draftPreview,
          draftId: result.draftId,
        })
      );
    }

    if (body.employeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: body.employeeId, companyId: session.user.companyId },
      });
      if (!employee) {
        return NextResponse.json({ error: "Staff not found" }, { status: 404 });
      }
    }

    if (body.assigneeUserId) {
      const user = await prisma.user.findFirst({
        where: {
          id: body.assigneeUserId,
          companyId: session.user.companyId,
          role: { in: ["SUPER_ADMIN", "HR_ADMIN"] },
        },
      });
      if (!user) {
        return NextResponse.json(
          { error: "HR assignee not found" },
          { status: 404 }
        );
      }
    }

    let nextStatus = body.status;
    if (
      !nextStatus &&
      body.assigneeUserId &&
      existing.status === "NEW"
    ) {
      nextStatus = "TRIAGED";
    }
    if (
      !nextStatus &&
      body.employeeId &&
      (existing.status === "NEW" || existing.status === "TRIAGED")
    ) {
      nextStatus = "ASSIGNED";
    }

    const updated = await prisma.hrDeskMessage.update({
      where: { id: params.id },
      data: {
        ...(body.employeeId !== undefined && {
          employeeId: body.employeeId,
          ...(!body.status &&
            body.employeeId && {
              status: "ASSIGNED" as const,
            }),
        }),
        ...(body.assigneeUserId !== undefined && {
          assigneeUserId: body.assigneeUserId,
        }),
        ...(body.category && { category: body.category }),
        ...(nextStatus && { status: nextStatus }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: messageInclude,
    });

    return NextResponse.json(serializeBigInts(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    if (/Assign this mail|Gmail|scope|insufficient/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
