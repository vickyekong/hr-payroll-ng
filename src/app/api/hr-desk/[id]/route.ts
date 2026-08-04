import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { createHrDecisionDraft } from "@/lib/hr-desk/service";
import { serializeBigInts } from "@/lib/payroll/config-mapper";
import { z } from "zod";

const patchSchema = z.object({
  employeeId: z.string().nullable().optional(),
  category: z
    .enum(["LEAVE", "RESIGNATION", "COMPLAINT", "INQUIRY", "PAYROLL", "GENERAL"])
    .optional(),
  status: z
    .enum(["NEW", "TRIAGED", "ASSIGNED", "APPROVED", "REJECTED", "CLOSED"])
    .optional(),
  notes: z.string().optional(),
  action: z.enum(["approve", "reject"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageLeave");
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
          },
        },
      });

      return NextResponse.json(
        serializeBigInts({
          ...result.message,
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

    const updated = await prisma.hrDeskMessage.update({
      where: { id: params.id },
      data: {
        ...(body.employeeId !== undefined && {
          employeeId: body.employeeId,
          status: body.employeeId ? "ASSIGNED" : existing.status,
        }),
        ...(body.category && { category: body.category }),
        ...(body.status && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: true,
          },
        },
      },
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
