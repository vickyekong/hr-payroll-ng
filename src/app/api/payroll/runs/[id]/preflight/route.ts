import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-auth";
import { getPayrollPreflight } from "@/lib/payroll/preflight";
import { can } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    if (
      !can(session.user.role, "runPayroll") &&
      !can(session.user.role, "approvePayroll")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const preflight = await getPayrollPreflight(
      session.user.companyId,
      params.id
    );
    return NextResponse.json(preflight);
  } catch (error) {
    if (error instanceof Error && error.message === "Payroll run not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return handleApiError(error);
  }
}
