import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { importPunchesFromCsv } from "@/lib/attendance/service";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const contentType = req.headers.get("content-type") ?? "";

    let csvText = "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
      }
      csvText = await file.text();
    } else {
      const body = await req.json();
      csvText = String(body.csv ?? body.text ?? "");
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: "Empty import" }, { status: 400 });
    }

    const result = await importPunchesFromCsv({
      companyId: session.user.companyId,
      csvText,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "IMPORT",
        entityType: "AttendancePunch",
        entityId: result.batch,
        performedById: session.user.id,
        changes: result,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
