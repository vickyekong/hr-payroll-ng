import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { listOpenLifecycles } from "@/lib/lifecycle/service";

/** Company-wide open onboarding / offboarding for HR. */
export async function GET() {
  try {
    const session = await requirePermission("manageEmployees");
    const lifecycles = await listOpenLifecycles(session.user.companyId);
    return NextResponse.json(lifecycles);
  } catch (error) {
    return handleApiError(error);
  }
}
