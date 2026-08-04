import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = updateSchema.parse(await req.json());

    const existing = await prisma.department.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const clash = await prisma.department.findFirst({
      where: {
        companyId: session.user.companyId,
        name: body.name,
        NOT: { id: params.id },
      },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Department already exists" },
        { status: 409 }
      );
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: { name: body.name },
    });

    // Keep employee department strings in sync when a department is renamed.
    await prisma.employee.updateMany({
      where: {
        companyId: session.user.companyId,
        department: existing.name,
      },
      data: { department: body.name },
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "UPDATE",
        entityType: "Department",
        entityId: department.id,
        performedById: session.user.id,
        changes: { from: existing.name, to: body.name },
      },
    });

    return NextResponse.json(department);
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
    const existing = await prisma.department.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const inUse = await prisma.employee.count({
      where: {
        companyId: session.user.companyId,
        department: existing.name,
      },
    });
    if (inUse > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete “${existing.name}” while ${inUse} employee(s) are assigned to it`,
        },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "DELETE",
        entityType: "Department",
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
