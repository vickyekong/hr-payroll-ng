import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  notifySuperAdminOfChangeRequest,
  reviewChangeRequest,
  submitChangeRequest,
} from "@/lib/lifecycle/change-requests";
import { displayName } from "@/lib/employees/data-quality";

const submitSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["BANK", "TAX_RELIEF", "NEXT_OF_KIN", "ADDRESS"]),
  payload: z.record(z.string(), z.unknown()),
  note: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") ?? "pending";

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
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = submitSchema.parse(await req.json());

    const employee = await prisma.employee.findFirst({
      where: { id: body.employeeId, companyId: session.user.companyId },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const created = await submitChangeRequest({
      companyId: session.user.companyId,
      employeeId: body.employeeId,
      type: body.type,
      payload: body.payload,
      note: body.note,
    });

    await notifySuperAdminOfChangeRequest({
      companyId: session.user.companyId,
      requestId: created.id,
      employeeName: displayName(
        employee.firstName,
        employee.lastName,
        employee.employeeCode
      ),
      type: body.type,
      submittedByName: session.user.name,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "CREATE",
        entityType: "EmployeeChangeRequest",
        entityId: created.id,
        performedById: session.user.id,
        changes: {
          type: body.type,
          employeeId: body.employeeId,
          payload: body.payload,
        },
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
    const session = await requirePermission("approveChangeRequests");
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
