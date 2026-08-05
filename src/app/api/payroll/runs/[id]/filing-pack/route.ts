import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import { buildStatutoryFilingPack } from "@/lib/reports/filing-pack";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    if (
      !can(session.user.role, "runPayroll") &&
      !can(session.user.role, "approvePayroll") &&
      !can(session.user.role, "viewReports")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pack = await buildStatutoryFilingPack(
      session.user.companyId,
      params.id
    );

    return new NextResponse(Buffer.from(pack.zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${pack.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Payroll run not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return handleApiError(error);
  }
}
