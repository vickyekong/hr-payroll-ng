import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { HR_ASK_QUERIES, runHrAskQuery } from "@/lib/hr-ask/queries";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get("q");

    if (!queryId) {
      return NextResponse.json({ queries: HR_ASK_QUERIES });
    }

    const result = await runHrAskQuery(session.user.companyId, queryId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unknown query") {
      return NextResponse.json({ error: "Unknown query" }, { status: 400 });
    }
    return handleApiError(error);
  }
}
