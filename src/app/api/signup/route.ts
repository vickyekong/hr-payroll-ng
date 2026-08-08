import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  bootstrapCompany,
  TenancyError,
} from "@/lib/tenancy/bootstrap-company";
import { handleApiError } from "@/lib/api-auth";

const signupSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  address: z.string().trim().max(240).optional().nullable(),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().max(180),
  adminPassword: z.string().min(8).max(128),
});

/**
 * Public tenant signup. Creates company + NTA defaults + Super Admin.
 * Demo Acme (seed-company / *@acme.ng) is untouched.
 */
export async function POST(req: NextRequest) {
  try {
    const body = signupSchema.parse(await req.json());
    const result = await bootstrapCompany({
      companyName: body.companyName,
      address: body.address,
      adminName: body.adminName,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
    });

    return NextResponse.json(
      {
        company: result.company,
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          name: result.admin.name,
          role: result.admin.role,
        },
        message: "Company created. Sign in to continue onboarding.",
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
