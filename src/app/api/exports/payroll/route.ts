import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError, AuthError } from "@/lib/api-auth";
import { buildPayrollExportCsv } from "@/lib/exports/payroll";
import { csvResponse } from "@/lib/reports/csv";
import { uploadCsvToGoogleDrive } from "@/lib/google-drive";
import { uploadCsvToMicrosoftOneDrive } from "@/lib/microsoft-workspace";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  runId: z.string().min(1),
  destination: z
    .enum(["download", "google_drive", "microsoft_onedrive"])
    .default("download"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("runPayroll");
    const runId = new URL(req.url).searchParams.get("runId");
    if (!runId) {
      throw new AuthError("runId is required", 400);
    }

    const { csv, filename } = await buildPayrollExportCsv(
      session.user.companyId,
      runId
    );
    return csvResponse(csv, filename);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("runPayroll");
    const body = bodySchema.parse(await req.json());
    const { csv, filename, rowCount, periodLabel } = await buildPayrollExportCsv(
      session.user.companyId,
      body.runId
    );

    if (body.destination === "download") {
      return csvResponse(csv, filename);
    }

    const uploaded =
      body.destination === "microsoft_onedrive"
        ? await uploadCsvToMicrosoftOneDrive({
            companyId: session.user.companyId,
            filename,
            csv,
          })
        : await uploadCsvToGoogleDrive({
            companyId: session.user.companyId,
            filename,
            csv,
          });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action:
          body.destination === "microsoft_onedrive"
            ? "EXPORT_MICROSOFT_ONEDRIVE"
            : "EXPORT_GOOGLE_DRIVE",
        entityType: "PayrollRun",
        entityId: body.runId,
        performedById: session.user.id,
        changes: {
          type: "payroll",
          filename,
          rowCount,
          periodLabel,
          fileId: uploaded.fileId,
          webViewLink: uploaded.webViewLink,
        },
      },
    });

    return NextResponse.json({
      success: true,
      filename,
      rowCount,
      periodLabel,
      fileId: uploaded.fileId,
      webViewLink: uploaded.webViewLink,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
