import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  folderId: z.string().nullable().optional(),
  disconnect: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("manageCompanySettings");
    const body = patchSchema.parse(await req.json());

    if (body.disconnect) {
      await prisma.googleDriveIntegration.deleteMany({
        where: { companyId: session.user.companyId },
      });
      await prisma.auditLog.create({
        data: {
          companyId: session.user.companyId,
          action: "DISCONNECT",
          entityType: "GoogleDriveIntegration",
          entityId: session.user.companyId,
          performedById: session.user.id,
        },
      });
      return NextResponse.json({ success: true, connected: false });
    }

    const existing = await prisma.googleDriveIntegration.findUnique({
      where: { companyId: session.user.companyId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Google Drive is not connected" },
        { status: 400 }
      );
    }

    const updated = await prisma.googleDriveIntegration.update({
      where: { companyId: session.user.companyId },
      data: {
        folderId:
          body.folderId === undefined ? existing.folderId : body.folderId,
      },
      select: { email: true, folderId: true, connectedAt: true },
    });

    return NextResponse.json({ success: true, ...updated, connected: true });
  } catch (error) {
    return handleApiError(error);
  }
}
