import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  getEmployeeLifecycles,
  startLifecycle,
} from "@/lib/lifecycle/service";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    const lifecycles = await getEmployeeLifecycles(
      session.user.companyId,
      params.id
    );
    return NextResponse.json(lifecycles);
  } catch (error) {
    return handleApiError(error);
  }
}

const startSchema = z.object({
  kind: z.enum(["ONBOARDING", "OFFBOARDING"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = startSchema.parse(await req.json());
    const lifecycle = await startLifecycle({
      companyId: session.user.companyId,
      employeeId: params.id,
      kind: body.kind,
    });
    return NextResponse.json(lifecycle, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
