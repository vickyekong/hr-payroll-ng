import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-auth";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { getMicrosoftWorkspaceStatus } from "@/lib/microsoft-workspace";

/** Combined Google + Microsoft connection state for export UI and settings hints. */
export async function GET() {
  try {
    const session = await requireAuth();
    const companyId = session.user.companyId;

    const google = await getGoogleDriveStatus(companyId);
    const microsoft = await getMicrosoftWorkspaceStatus(companyId);

    return NextResponse.json({
      google: {
        configured: google.configured,
        connected: google.connected,
        email: google.email,
      },
      microsoft: {
        configured: microsoft.configured,
        connected: microsoft.connected,
        email: microsoft.email,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
