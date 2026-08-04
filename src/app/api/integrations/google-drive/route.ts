import { NextResponse } from "next/server";
import {
  requireAuth,
  requirePermission,
  handleApiError,
  AuthError,
} from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import {
  getGoogleAuthUrl,
  getGoogleDriveStatus,
  isGoogleDriveConfigured,
} from "@/lib/google-drive";
import { randomBytes } from "crypto";

export async function GET() {
  try {
    const session = await requireAuth();
    if (
      !can(session.user.role, "manageCompanySettings") &&
      !can(session.user.role, "manageEmployees") &&
      !can(session.user.role, "runPayroll")
    ) {
      throw new AuthError("Forbidden", 403);
    }
    const status = await getGoogleDriveStatus(session.user.companyId);
    return NextResponse.json(status);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    const session = await requirePermission("manageCompanySettings");

    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        {
          error:
            "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables first.",
        },
        { status: 400 }
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({
        companyId: session.user.companyId,
        userId: session.user.id,
        nonce,
      })
    ).toString("base64url");

    const url = getGoogleAuthUrl(state);
    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error);
  }
}
