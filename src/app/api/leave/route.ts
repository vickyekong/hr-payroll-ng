import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, handleApiError, AuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import { countWorkingDaysBetween } from "@/lib/leave/unpaid-leave";
import { z } from "zod";

const leaveSchema = z.object({
  type: z.enum(["ANNUAL", "SICK", "MATERNITY", "PATERNITY", "UNPAID"]),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number().min(1).optional(),
  reason: z.string().optional(),
});

export async function GET() {
  try {
    const session = await requireAuth();

    const where =
      session.user.role === "EMPLOYEE" && session.user.employeeId
        ? { employeeId: session.user.employeeId }
        : {
            employee: { companyId: session.user.companyId },
            ...(can(session.user.role, "manageLeave") ? {} : {}),
          };

    if (!can(session.user.role, "manageLeave") && session.user.role !== "EMPLOYEE") {
      throw new AuthError("Forbidden", 403);
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeCode: true },
        },
        approvedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const body = leaveSchema.parse(await req.json());

    const employeeId = session.user.employeeId;
    if (!employeeId) {
      throw new AuthError("Employee account required", 403);
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (endDate < startDate) {
      return NextResponse.json(
        { error: "End date must be on or after start date" },
        { status: 400 }
      );
    }

    const computedDays = countWorkingDaysBetween(startDate, endDate);
    if (computedDays < 1) {
      return NextResponse.json(
        { error: "Leave must include at least one working day" },
        { status: 400 }
      );
    }

    const days = body.days ?? computedDays;
    if (days !== computedDays) {
      return NextResponse.json(
        {
          error: `Working days between dates is ${computedDays}, but ${days} was submitted`,
        },
        { status: 400 }
      );
    }

    if (body.type === "ANNUAL") {
      const year = startDate.getFullYear();
      const balance = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveType_year: {
            employeeId,
            leaveType: "ANNUAL",
            year,
          },
        },
      });
      const remaining = (balance?.entitledDays ?? 21) - (balance?.usedDays ?? 0);
      if (days > remaining) {
        return NextResponse.json(
          { error: `Insufficient annual leave balance (${remaining} days remaining)` },
          { status: 400 }
        );
      }
    }

    const request = await prisma.leaveRequest.create({
      data: {
        employeeId,
        type: body.type,
        startDate,
        endDate,
        days,
        reason: body.reason,
        status: "PENDING",
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
