import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  inviteTeamUser,
  TenancyError,
} from "@/lib/tenancy/bootstrap-company";

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(128),
  role: z.enum(["HR_ADMIN", "SUPER_ADMIN"]).default("HR_ADMIN"),
});

/** Super Admin invites HR (or another Super Admin) into their company. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageCompanySettings");
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can invite team members" },
        { status: 403 }
      );
    }

    const body = inviteSchema.parse(await req.json());
    const user = await inviteTeamUser({
      companyId: session.user.companyId,
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
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
