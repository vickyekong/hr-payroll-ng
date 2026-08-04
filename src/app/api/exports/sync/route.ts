import {
  requireAuth,
  handleApiError,
  AuthError,
} from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import {
  syncStaffToWorkspace,
  syncPayrollToWorkspace,
} from "@/lib/google-drive";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const bodySchema = z.object({
  type: z.enum(["staff", "payroll"]),
  runId: z.string().optional(),
});

/** Allow HR/Finance to sync the dataset they can already export. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = bodySchema.parse(await req.json());

    if (body.type === "staff") {
      if (!can(session.user.role, "manageEmployees")) {
        throw new AuthError("Forbidden", 403);
      }
      const result = await syncStaffToWorkspace(session.user.companyId);
      await prisma.auditLog.create({
        data: {
          companyId: session.user.companyId,
          action: "SYNC_GOOGLE_WORKSPACE",
          entityType: "Employee",
          entityId: session.user.companyId,
          performedById: session.user.id,
          changes: result,
        },
      });
      return NextResponse.json({ success: true, result });
    }

    if (!can(session.user.role, "runPayroll") && !can(session.user.role, "approvePayroll")) {
      throw new AuthError("Forbidden", 403);
    }

    const result = await syncPayrollToWorkspace(
      session.user.companyId,
      body.runId
    );
    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "SYNC_GOOGLE_WORKSPACE",
        entityType: "PayrollRun",
        entityId: body.runId ?? session.user.companyId,
        performedById: session.user.id,
        changes: result,
      },
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return handleApiError(error);
  }
}
