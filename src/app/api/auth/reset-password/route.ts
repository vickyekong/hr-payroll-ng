import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { resetPasswordWithToken } from "@/lib/auth/account";
import { handleApiError } from "@/lib/api-auth";
import { TenancyError } from "@/lib/tenancy/bootstrap-company";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const body = bodySchema.parse(await req.json());
    await resetPasswordWithToken(body.token, body.password);

    return NextResponse.json({
      success: true,
      message: "Password updated. You can sign in now.",
    });
  } catch (error) {
    if (error instanceof TenancyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
