import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { normalizeHex } from "@/lib/company-brand";
import { ensureCompanyBrandingSchema } from "@/lib/ensure-company-branding-schema";
import { z } from "zod";

const hexSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (v) => v === undefined || v === null || v === "" || normalizeHex(v) !== null,
    { message: "Colors must be #RRGGBB" }
  );

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  logoUrl: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) =>
        v === undefined ||
        v === null ||
        v === "" ||
        v.startsWith("https://") ||
        v.startsWith("http://") ||
        (v.startsWith("data:image/") && v.length <= 220_000),
      { message: "Logo must be an image URL or a small uploaded image" }
    ),
  brandAccentHex: hexSchema,
  brandInkHex: hexSchema,
});

function serialize(company: {
  name: string;
  logoUrl: string | null;
  brandAccentHex: string | null;
  brandInkHex: string | null;
}) {
  return {
    name: company.name,
    logoUrl: company.logoUrl,
    brandAccentHex: company.brandAccentHex,
    brandInkHex: company.brandInkHex,
  };
}

export async function GET() {
  try {
    const session = await requirePermission("manageCompanySettings");
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
    return NextResponse.json(serialize(company));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("manageCompanySettings");
    await ensureCompanyBrandingSchema();
    const body = updateSchema.parse(await req.json());

    const data: {
      name?: string;
      logoUrl?: string | null;
      brandAccentHex?: string | null;
      brandInkHex?: string | null;
    } = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.logoUrl !== undefined) {
      data.logoUrl = body.logoUrl === "" ? null : body.logoUrl;
    }
    if (body.brandAccentHex !== undefined) {
      data.brandAccentHex =
        body.brandAccentHex === "" || body.brandAccentHex === null
          ? null
          : normalizeHex(body.brandAccentHex);
    }
    if (body.brandInkHex !== undefined) {
      data.brandInkHex =
        body.brandInkHex === "" || body.brandInkHex === null
          ? null
          : normalizeHex(body.brandInkHex);
    }

    const updated = await prisma.company.update({
      where: { id: session.user.companyId },
      data,
      select: {
        name: true,
        logoUrl: true,
        brandAccentHex: true,
        brandInkHex: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "UPDATE",
        entityType: "CompanyBranding",
        entityId: session.user.companyId,
        performedById: session.user.id,
        changes: {
          name: data.name,
          logoUrl: data.logoUrl === undefined ? undefined : data.logoUrl ? "[set]" : null,
          brandAccentHex: data.brandAccentHex,
          brandInkHex: data.brandInkHex,
        },
      },
    });

    return NextResponse.json(serialize(updated));
  } catch (error) {
    return handleApiError(error);
  }
}
