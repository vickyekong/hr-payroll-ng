import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");

    const document = await prisma.employeeDocument.findFirst({
      where: {
        id: params.documentId,
        employeeId: params.id,
        employee: { companyId: session.user.companyId },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.employeeDocument.delete({ where: { id: document.id } });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "DELETE",
        entityType: "EmployeeDocument",
        entityId: document.id,
        performedById: session.user.id,
        changes: { name: document.name, employeeId: params.id },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
