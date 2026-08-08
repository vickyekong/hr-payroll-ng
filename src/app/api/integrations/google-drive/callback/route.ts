import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { exchangeGoogleCode } from "@/lib/google-drive";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "";
  const settingsUrl = `${base}/settings?googleDrive=`;

  try {
    const session = await getServerSession(authOptions);
    if (
      !session?.user ||
      !can(session.user.role, "manageCompanySettings") ||
      session.user.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(`${settingsUrl}forbidden`);
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateRaw = searchParams.get("state");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      return NextResponse.redirect(`${settingsUrl}denied`);
    }
    if (!code || !stateRaw) {
      return NextResponse.redirect(`${settingsUrl}missing_code`);
    }

    const state = JSON.parse(
      Buffer.from(stateRaw, "base64url").toString("utf8")
    ) as { companyId: string; userId: string };

    if (
      state.companyId !== session.user.companyId ||
      state.userId !== session.user.id
    ) {
      return NextResponse.redirect(`${settingsUrl}invalid_state`);
    }

    const { refreshToken, email } = await exchangeGoogleCode(code);

    await prisma.googleDriveIntegration.upsert({
      where: { companyId: session.user.companyId },
      update: {
        refreshToken,
        email: email ?? undefined,
      },
      create: {
        companyId: session.user.companyId,
        refreshToken,
        email: email ?? undefined,
        folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "CONNECT",
        entityType: "GoogleDriveIntegration",
        entityId: session.user.companyId,
        performedById: session.user.id,
        changes: { email },
      },
    });

    return NextResponse.redirect(`${settingsUrl}connected`);
  } catch (error) {
    console.error("Google Drive OAuth callback failed", error);
    return NextResponse.redirect(`${settingsUrl}error`);
  }
}
