import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { checkPortalCredentials } from "@/lib/auth/account";
import { handleApiError } from "@/lib/api-auth";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
});

/** Pre-flight login checks — email verification, 2FA, before NextAuth signIn. */
export async function POST(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const body = bodySchema.parse(await req.json());
    const result = await checkPortalCredentials(
      body.email,
      body.password,
      body.totp
    );

    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
