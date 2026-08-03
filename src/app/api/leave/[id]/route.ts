import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageLeave");
    const body = actionSchema.parse(await req.json());

    const leave = await prisma.leaveRequest.findFirst({
      where: {
        id: params.id,
        employee: { companyId: session.user.companyId },
      },
      include: { employee: true },
    });

    if (!leave) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (leave.status !== "PENDING") {
      return NextResponse.json({ error: "Already processed" }, { status: 400 });
    }

    const status = body.action === "approve" ? "APPROVED" : "REJECTED";

    const updated = await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status,
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });

    if (status === "APPROVED" && leave.type === "ANNUAL") {
      const year = new Date(leave.startDate).getFullYear();
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveType_year: {
            employeeId: leave.employeeId,
            leaveType: "ANNUAL",
            year,
          },
        },
        update: { usedDays: { increment: leave.days } },
        create: {
          employeeId: leave.employeeId,
          leaveType: "ANNUAL",
          year,
          entitledDays: 21,
          usedDays: leave.days,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: status,
        entityType: "LeaveRequest",
        entityId: leave.id,
        performedById: session.user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
