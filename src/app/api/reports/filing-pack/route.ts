import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { getApprovedPayrollRun } from "@/lib/reports/remittances";
import { buildStatutoryFilingPack } from "@/lib/reports/filing-pack";

/** Filing pack for an approved/paid period (Reports page). */
export async function GET(req: Request) {
  try {
    const session = await requirePermission("viewReports");
    const { searchParams } = new URL(req.url);
    const month = parseInt(
      searchParams.get("month") ?? String(new Date().getMonth() + 1)
    );
    const year = parseInt(
      searchParams.get("year") ?? String(new Date().getFullYear())
    );

    const run = await getApprovedPayrollRun(
      session.user.companyId,
      month,
      year
    );

    if (!run) {
      return NextResponse.json(
        { error: "No approved payroll run for this period" },
        { status: 404 }
      );
    }

    const pack = await buildStatutoryFilingPack(
      session.user.companyId,
      run.id
    );

    return new NextResponse(Buffer.from(pack.zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${pack.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
