import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { issueEmailVerification } from "@/lib/auth/account";
import { handleApiError } from "@/lib/api-auth";

const bodySchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const body = bodySchema.parse(await req.json());
    const user = await issueEmailVerificationByEmail(body.email);

    return NextResponse.json({
      success: true,
      message: user
        ? "Verification email sent."
        : "If that email is registered and unverified, we sent a link.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function issueEmailVerificationByEmail(email: string) {
  const { prisma } = await import("@/lib/db");
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return false;
  await issueEmailVerification(user.id);
  return true;
}
