import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  syncStaffToMicrosoftWorkspace,
  syncPayrollToMicrosoftWorkspace,
} from "@/lib/microsoft-workspace";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  type: z.enum(["staff", "payroll", "all"]),
  runId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageCompanySettings");
    const body = bodySchema.parse(await req.json());
    const results = [];

    if (body.type === "staff" || body.type === "all") {
      const staff = await syncStaffToMicrosoftWorkspace(session.user.companyId);
      results.push(staff);
      await prisma.auditLog.create({
        data: {
          companyId: session.user.companyId,
          action: "SYNC_MICROSOFT_WORKSPACE",
          entityType: "Employee",
          entityId: session.user.companyId,
          performedById: session.user.id,
          changes: staff,
        },
      });
    }

    if (body.type === "payroll" || body.type === "all") {
      const payroll = await syncPayrollToMicrosoftWorkspace(
        session.user.companyId,
        body.runId
      );
      results.push(payroll);
      await prisma.auditLog.create({
        data: {
          companyId: session.user.companyId,
          action: "SYNC_MICROSOFT_WORKSPACE",
          entityType: "PayrollRun",
          entityId: body.runId ?? session.user.companyId,
          performedById: session.user.id,
          changes: payroll,
        },
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return handleApiError(error);
  }
}
