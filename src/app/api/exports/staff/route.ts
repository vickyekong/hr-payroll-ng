import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { buildStaffExportCsv } from "@/lib/exports/staff";
import { csvResponse } from "@/lib/reports/csv";
import { uploadCsvToGoogleDrive } from "@/lib/google-drive";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  destination: z.enum(["download", "google_drive"]).default("download"),
});

export async function GET() {
  try {
    const session = await requirePermission("manageEmployees");
    const { csv, filename } = await buildStaffExportCsv(session.user.companyId);
    return csvResponse(csv, filename);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const { csv, filename, rowCount } = await buildStaffExportCsv(
      session.user.companyId
    );

    if (body.destination === "download") {
      return csvResponse(csv, filename);
    }

    const uploaded = await uploadCsvToGoogleDrive({
      companyId: session.user.companyId,
      filename,
      csv,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "EXPORT_GOOGLE_DRIVE",
        entityType: "Employee",
        entityId: session.user.companyId,
        performedById: session.user.id,
        changes: {
          type: "staff",
          filename,
          rowCount,
          fileId: uploaded.fileId,
          webViewLink: uploaded.webViewLink,
        },
      },
    });

    return NextResponse.json({
      success: true,
      filename,
      rowCount,
      fileId: uploaded.fileId,
      webViewLink: uploaded.webViewLink,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
