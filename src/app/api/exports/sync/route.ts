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
import {
  syncStaffToMicrosoftWorkspace,
  syncPayrollToMicrosoftWorkspace,
} from "@/lib/microsoft-workspace";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const bodySchema = z.object({
  type: z.enum(["staff", "payroll"]),
  runId: z.string().optional(),
  provider: z.enum(["google", "microsoft"]).default("google"),
});

/** Allow HR/Finance to sync staff/payroll workbooks to Google Sheets or Microsoft Excel. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = bodySchema.parse(await req.json());

    if (body.type === "staff") {
      if (!can(session.user.role, "manageEmployees")) {
        throw new AuthError("Forbidden", 403);
      }

      const result =
        body.provider === "microsoft"
          ? await syncStaffToMicrosoftWorkspace(session.user.companyId)
          : await syncStaffToWorkspace(session.user.companyId);

      await prisma.auditLog.create({
        data: {
          companyId: session.user.companyId,
          action:
            body.provider === "microsoft"
              ? "SYNC_MICROSOFT_WORKSPACE"
              : "SYNC_GOOGLE_WORKSPACE",
          entityType: "Employee",
          entityId: session.user.companyId,
          performedById: session.user.id,
          changes: result,
        },
      });
      return NextResponse.json({ success: true, provider: body.provider, result });
    }

    if (
      !can(session.user.role, "runPayroll") &&
      !can(session.user.role, "approvePayroll")
    ) {
      throw new AuthError("Forbidden", 403);
    }

    const result =
      body.provider === "microsoft"
        ? await syncPayrollToMicrosoftWorkspace(
            session.user.companyId,
            body.runId
          )
        : await syncPayrollToWorkspace(session.user.companyId, body.runId);

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action:
          body.provider === "microsoft"
            ? "SYNC_MICROSOFT_WORKSPACE"
            : "SYNC_GOOGLE_WORKSPACE",
        entityType: "PayrollRun",
        entityId: body.runId ?? session.user.companyId,
        performedById: session.user.id,
        changes: result,
      },
    });
    return NextResponse.json({ success: true, provider: body.provider, result });
  } catch (error) {
    return handleApiError(error);
  }
}
