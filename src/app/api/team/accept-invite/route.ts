import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import {
  acceptTeamInvite,
  getTeamInvitePreview,
} from "@/lib/auth/account";
import { handleApiError } from "@/lib/api-auth";
import { TenancyError } from "@/lib/tenancy/bootstrap-company";

const acceptSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function GET(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    const preview = await getTeamInvitePreview(token);
    if (!preview) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    return NextResponse.json({ preview });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureAuthSchema();
    const body = acceptSchema.parse(await req.json());
    const result = await acceptTeamInvite(body.token, body.password);
    return NextResponse.json({
      success: true,
      user: result.user,
      companyName: result.companyName,
    });
  } catch (error) {
    if (error instanceof TenancyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error);
  }
}
