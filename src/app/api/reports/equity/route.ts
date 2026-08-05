import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { getPayEquityReport } from "@/lib/reports/pay-equity";

export async function GET() {
  try {
    const session = await requirePermission("viewReports");
    const report = await getPayEquityReport(session.user.companyId);
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}
