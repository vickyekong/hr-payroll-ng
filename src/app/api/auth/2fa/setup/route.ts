import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { prisma } from "@/lib/db";
import {
  encryptTotpSecret,
  generateTotpSecret,
  totpOtpAuthUri,
  verifyTotpCode,
} from "@/lib/auth/totp";
import { handleApiError } from "@/lib/api-auth";

const confirmSchema = z.object({
  code: z.string().min(6).max(8),
});

/** Start TOTP setup — returns secret + otpauth URI (not enabled until confirmed). */
export async function POST() {
  try {
    await ensureAuthSchema();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        totpSecret: encryptTotpSecret(secret),
        totpEnabled: false,
      },
    });

    return NextResponse.json({
      secret,
      otpauthUri: totpOtpAuthUri({
        secret,
        email: session.user.email,
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Confirm authenticator app and enable 2FA. */
export async function PUT(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = confirmSchema.parse(await req.json());
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { totpSecret: true },
    });

    const { decryptTotpSecret } = await import("@/lib/auth/totp");
    const secret = decryptTotpSecret(user.totpSecret);
    if (!secret || !verifyTotpCode(secret, body.code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpEnabled: true },
    });

    return NextResponse.json({ success: true, totpEnabled: true });
  } catch (error) {
    return handleApiError(error);
  }
}

const disableSchema = z.object({
  password: z.string().min(1),
  code: z.string().min(6).max(8),
});

/** Disable 2FA after password + current TOTP code. */
export async function DELETE(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = disableSchema.parse(await req.json());
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { passwordHash: true, totpSecret: true, totpEnabled: true },
    });

    if (!user.totpEnabled) {
      return NextResponse.json({ success: true, totpEnabled: false });
    }

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 });
    }

    const { decryptTotpSecret } = await import("@/lib/auth/totp");
    const secret = decryptTotpSecret(user.totpSecret);
    if (!secret || !verifyTotpCode(secret, body.code)) {
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpEnabled: false, totpSecret: null },
    });

    return NextResponse.json({ success: true, totpEnabled: false });
  } catch (error) {
    return handleApiError(error);
  }
}
