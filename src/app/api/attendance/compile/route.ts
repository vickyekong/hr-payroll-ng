import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { compileAttendancePeriod } from "@/lib/attendance/service";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = bodySchema.parse(await req.json());
    const result = await compileAttendancePeriod({
      companyId: session.user.companyId,
      periodMonth: body.month,
      periodYear: body.year,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "COMPILE",
        entityType: "AttendanceDay",
        entityId: `${body.year}-${body.month}`,
        performedById: session.user.id,
        changes: result,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
