import { NextRequest, NextResponse } from "next/server";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { verifyEmailWithToken } from "@/lib/auth/account";
import { TenancyError } from "@/lib/tenancy/bootstrap-company";

export async function GET(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const result = await verifyEmailWithToken(token);
    return NextResponse.json({
      success: true,
      alreadyVerified: result.alreadyVerified,
    });
  } catch (error) {
    if (error instanceof TenancyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
