import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { requestPasswordReset } from "@/lib/auth/account";
import { handleApiError } from "@/lib/api-auth";

const bodySchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const body = bodySchema.parse(await req.json());
    await requestPasswordReset(body.email);

    return NextResponse.json({
      success: true,
      message:
        "If that email is registered, we sent a password reset link. Check your inbox.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
