import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { completeLifecycleTask } from "@/lib/lifecycle/service";
import { prisma } from "@/lib/db";

const schema = z.object({
  status: z.enum(["DONE", "SKIPPED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = schema.parse(await req.json());

    const belongs = await prisma.employeeLifecycleTask.findFirst({
      where: {
        id: params.taskId,
        lifecycle: {
          employeeId: params.id,
          companyId: session.user.companyId,
        },
      },
    });
    if (!belongs) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const lifecycle = await completeLifecycleTask({
      companyId: session.user.companyId,
      taskId: params.taskId,
      userId: session.user.id,
      status: body.status,
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: body.status === "DONE" ? "COMPLETE_TASK" : "SKIP_TASK",
        entityType: "EmployeeLifecycleTask",
        entityId: params.taskId,
        performedById: session.user.id,
        changes: { employeeId: params.id, status: body.status },
      },
    });

    return NextResponse.json(lifecycle);
  } catch (error) {
    return handleApiError(error);
  }
}
