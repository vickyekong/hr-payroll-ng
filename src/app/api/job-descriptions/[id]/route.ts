import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { ensureJobDescriptionTable } from "@/lib/org/ensure-org-structure";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    await ensureJobDescriptionTable();
    const body = updateSchema.parse(await req.json());

    const existing = await prisma.jobDescription.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const clash = await prisma.jobDescription.findFirst({
      where: {
        companyId: session.user.companyId,
        name: body.name,
        NOT: { id: params.id },
      },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Job description already exists" },
        { status: 409 }
      );
    }

    const row = await prisma.jobDescription.update({
      where: { id: params.id },
      data: { name: body.name },
    });

    await prisma.employee.updateMany({
      where: {
        companyId: session.user.companyId,
        jobTitle: existing.name,
      },
      data: { jobTitle: body.name },
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "UPDATE",
        entityType: "JobDescription",
        entityId: row.id,
        performedById: session.user.id,
        changes: { from: existing.name, to: body.name },
      },
    });

    return NextResponse.json(row);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    await ensureJobDescriptionTable();
    const existing = await prisma.jobDescription.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const inUse = await prisma.employee.count({
      where: {
        companyId: session.user.companyId,
        jobTitle: existing.name,
      },
    });
    if (inUse > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete “${existing.name}” while ${inUse} employee(s) use it as their job description`,
        },
        { status: 400 }
      );
    }

    await prisma.jobDescription.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "DELETE",
        entityType: "JobDescription",
        entityId: params.id,
        performedById: session.user.id,
        changes: { name: existing.name },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
