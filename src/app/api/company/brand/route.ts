import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, AuthError } from "@/lib/api-auth";
import { ensureCompanyBrandingSchema } from "@/lib/ensure-company-branding-schema";

/** Branding for the signed-in user's company — used by the shell theme. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.companyId) {
      throw new AuthError("Unauthorized", 401);
    }

    await ensureCompanyBrandingSchema();

    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: {
        name: true,
        logoUrl: true,
        brandAccentHex: true,
        brandInkHex: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    return handleApiError(error);
  }
}
