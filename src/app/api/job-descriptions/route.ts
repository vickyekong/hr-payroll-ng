import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { ensureJobDescriptionTable } from "@/lib/org/ensure-org-structure";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET() {
  try {
    const session = await requirePermission("manageEmployees");
    await ensureJobDescriptionTable();
    const rows = await prisma.jobDescription.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    await ensureJobDescriptionTable();
    const body = createSchema.parse(await req.json());
    const name = body.name;

    const existing = await prisma.jobDescription.findUnique({
      where: {
        companyId_name: {
          companyId: session.user.companyId,
          name,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Job description already exists" },
        { status: 409 }
      );
    }

    const row = await prisma.jobDescription.create({
      data: {
        companyId: session.user.companyId,
        name,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "CREATE",
        entityType: "JobDescription",
        entityId: row.id,
        performedById: session.user.id,
        changes: { name },
      },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
