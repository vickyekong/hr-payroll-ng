import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { syncHrDeskInbox } from "@/lib/hr-desk/service";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const session = await requirePermission("manageHrDesk");
    const { ensureHrDeskSchema } = await import("@/lib/ensure-hr-desk-schema");
    await ensureHrDeskSchema();
    const result = await syncHrDeskInbox(session.user.companyId);

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "SYNC",
        entityType: "HrDeskMessage",
        entityId: session.user.companyId,
        performedById: session.user.id,
        changes: result,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    if (/insufficient|scope|gmail/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Gmail permission missing. Reconnect Google Workspace in Settings (you will be asked for Gmail access).",
        },
        { status: 403 }
      );
    }
    return handleApiError(error);
  }
}
