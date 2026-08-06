import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  requirePermission,
  handleApiError,
} from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  notifyHrOfChangeRequest,
  reviewChangeRequest,
  submitChangeRequest,
} from "@/lib/lifecycle/change-requests";
import { displayName } from "@/lib/employees/data-quality";
import { can } from "@/lib/permissions";

const submitSchema = z.object({
  type: z.enum(["BANK", "TAX_RELIEF", "NEXT_OF_KIN", "ADDRESS"]),
  payload: z.record(z.string(), z.unknown()),
  note: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") ?? "mine";

    if (scope === "pending" || scope === "all") {
      if (!can(session.user.role, "manageEmployees")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const requests = await prisma.employeeChangeRequest.findMany({
        where: {
          companyId: session.user.companyId,
          ...(scope === "pending" ? { status: "PENDING" } : {}),
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
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return NextResponse.json(requests);
    }

    if (!session.user.employeeId) {
      return NextResponse.json({ error: "No employee linked" }, { status: 400 });
    }

    const mine = await prisma.employeeChangeRequest.findMany({
      where: { employeeId: session.user.employeeId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(mine);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session.user.employeeId) {
      return NextResponse.json(
        { error: "Only linked employees can submit change requests" },
        { status: 403 }
      );
    }

    const body = submitSchema.parse(await req.json());
    const created = await submitChangeRequest({
      companyId: session.user.companyId,
      employeeId: session.user.employeeId,
      type: body.type,
      payload: body.payload,
      note: body.note,
    });

    const emp = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: { firstName: true, lastName: true, employeeCode: true },
    });

    await notifyHrOfChangeRequest({
      companyId: session.user.companyId,
      requestId: created.id,
      employeeName: displayName(
        emp?.firstName,
        emp?.lastName,
        emp?.employeeCode ?? "Employee"
      ),
      type: body.type,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "CREATE",
        entityType: "EmployeeChangeRequest",
        entityId: created.id,
        performedById: session.user.id,
        changes: { type: body.type, payload: body.payload },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}

const reviewSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = reviewSchema.parse(await req.json());

    const updated = await reviewChangeRequest({
      companyId: session.user.companyId,
      requestId: body.requestId,
      reviewerId: session.user.id,
      action: body.action,
      reviewNote: body.reviewNote,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: body.action.toUpperCase(),
        entityType: "EmployeeChangeRequest",
        entityId: updated.id,
        performedById: session.user.id,
        changes: { reviewNote: body.reviewNote },
      },
    });

    await prisma.notification.updateMany({
      where: {
        entityType: "EmployeeChangeRequest",
        entityId: updated.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
