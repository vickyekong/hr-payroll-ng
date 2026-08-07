import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  importPunches,
  importPunchesFromCsv,
} from "@/lib/attendance/service";
import { parseClockPdf } from "@/lib/attendance/parse-clock-pdf";
import { parseClockExcel } from "@/lib/attendance/parse-clock-excel";
import { parseTimecardText } from "@/lib/attendance/parse-timecard-text";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageAttendance");
    const contentType = req.headers.get("content-type") ?? "";

    let result;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Attendance file is required (CSV, PDF, or Excel)" },
          { status: 400 }
        );
      }

      const ext = extensionOf(file.name);
      const mime = (file.type || "").toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      const isPdf =
        ext === "pdf" ||
        mime.includes("pdf");
      const isExcel =
        ext === "xlsx" ||
        ext === "xls" ||
        mime.includes("spreadsheet") ||
        mime.includes("excel");

      if (isPdf) {
        const parsed = await parseClockPdf(buffer);
        if (parsed.rows.length === 0) {
          return NextResponse.json(
            {
              error: "No punches found in PDF",
              parseErrors: parsed.errors,
            },
            { status: 400 }
          );
        }
        result = await importPunches({
          companyId: session.user.companyId,
          rows: parsed.rows,
          parseErrors: parsed.errors,
          source: "PDF_IMPORT",
        });
      } else if (isExcel) {
        const parsed = parseClockExcel(buffer);
        if (parsed.rows.length === 0) {
          return NextResponse.json(
            {
              error: "No punches found in Excel file",
              parseErrors: parsed.errors,
            },
            { status: 400 }
          );
        }
        result = await importPunches({
          companyId: session.user.companyId,
          rows: parsed.rows,
          parseErrors: parsed.errors,
          source: "EXCEL_IMPORT",
        });
      } else {
        // CSV / TSV / TXT — also accept Time Card text dumps
        const text = buffer.toString("utf8");
        const csvResult = await importPunchesFromCsv({
          companyId: session.user.companyId,
          csvText: text,
        });
        if (csvResult.parsed > 0) {
          result = csvResult;
        } else {
          const timecard = parseTimecardText(text);
          if (timecard.rows.length === 0) {
            return NextResponse.json(
              {
                error: "No punches found in file",
                parseErrors: [
                  ...csvResult.parseErrors,
                  ...timecard.errors,
                ].slice(0, 20),
              },
              { status: 400 }
            );
          }
          result = await importPunches({
            companyId: session.user.companyId,
            rows: timecard.rows,
            parseErrors: timecard.errors,
            source: "CSV_IMPORT",
          });
        }
      }
    } else {
      const body = await req.json();
      const csvText = String(body.csv ?? body.text ?? "");
      if (!csvText.trim()) {
        return NextResponse.json({ error: "Empty import" }, { status: 400 });
      }
      result = await importPunchesFromCsv({
        companyId: session.user.companyId,
        csvText,
      });
    }

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
