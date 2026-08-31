import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { createTeamInvite } from "@/lib/auth/account";
import { TenancyError } from "@/lib/tenancy/bootstrap-company";
import { prisma } from "@/lib/db";

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  role: z.enum(["HR_ADMIN", "SUPER_ADMIN"]).default("HR_ADMIN"),
});

/** Super Admin sends an email invite — teammate sets their own password. */
export async function POST(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const session = await requirePermission("manageCompanySettings");
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can invite team members" },
        { status: 403 }
      );
    }

    const body = inviteSchema.parse(await req.json());
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: session.user.companyId },
      select: { name: true },
    });

    const invite = await createTeamInvite({
      companyId: session.user.companyId,
      companyName: company.name,
      invitedById: session.user.id,
      inviterName: session.user.name ?? "Super Admin",
      name: body.name,
      email: body.email,
      role: body.role,
    });

    return NextResponse.json(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          name: invite.name,
          role: invite.role,
        },
        message: `Invite sent to ${invite.email}.`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenancyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return handleApiError(error);
  }
}
