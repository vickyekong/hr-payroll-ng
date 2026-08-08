import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-auth";

/**
 * Employee self-service payslips are retired.
 * OmniPeople is HR/Admin only — employees are managed records, not users.
 */
export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json(
      {
        error:
          "Employee self-service payslips are not available. Use Payroll → payslips as HR or Super Admin.",
      },
      { status: 410 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
