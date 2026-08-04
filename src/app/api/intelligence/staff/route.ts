import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { getStaffIntelligence } from "@/lib/intelligence/staff-insights";
import { serializeBigInts } from "@/lib/payroll/config-mapper";

export async function GET() {
  try {
    const session = await requirePermission("manageEmployees");
    const data = await getStaffIntelligence(session.user.companyId);
    return NextResponse.json(serializeBigInts(data));
  } catch (error) {
    return handleApiError(error);
  }
}
