import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { serializeBigInts } from "@/lib/payroll/config-mapper";
import { ensureHrDeskSchema } from "@/lib/ensure-hr-desk-schema";
import { PERMISSIONS } from "@/lib/permissions";

const assigneeInclude = {
  select: { id: true, name: true, email: true, role: true },
} as const;

const employeeInclude = {
  select: {
    id: true,
    employeeCode: true,
    firstName: true,
    lastName: true,
    department: true,
  },
} as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("manageHrDesk");
    await ensureHrDeskSchema();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const id = searchParams.get("id");

    if (id) {
      const message = await prisma.hrDeskMessage.findFirst({
        where: { id, companyId: session.user.companyId },
        include: {
          employee: employeeInclude,
          assigneeUser: assigneeInclude,
        },
      });
      if (!message) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(serializeBigInts(message));
    }

    const [messages, integration, employees, hrUsers, counts] =
      await Promise.all([
        prisma.hrDeskMessage.findMany({
          where: {
            companyId: session.user.companyId,
            ...(category ? { category: category as never } : {}),
            ...(status ? { status: status as never } : {}),
          },
          include: {
            employee: employeeInclude,
            assigneeUser: assigneeInclude,
          },
          orderBy: { receivedAt: "desc" },
          take: 100,
        }),
        prisma.googleDriveIntegration.findUnique({
          where: { companyId: session.user.companyId },
          select: { email: true, lastHrMailSyncAt: true, connectedAt: true },
        }),
        prisma.employee.findMany({
          where: {
            companyId: session.user.companyId,
            status: { in: ["ACTIVE", "ON_LEAVE", "SICK_LEAVE"] },
          },
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: true,
          },
          orderBy: { employeeCode: "asc" },
        }),
        prisma.user.findMany({
          where: {
            companyId: session.user.companyId,
            role: { in: PERMISSIONS.manageHrDesk },
          },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" },
        }),
        prisma.hrDeskMessage.groupBy({
          by: ["category"],
          where: { companyId: session.user.companyId },
          _count: true,
        }),
      ]);

    return NextResponse.json(
      serializeBigInts({
        mailbox: integration?.email ?? null,
        lastSyncAt: integration?.lastHrMailSyncAt ?? null,
        connected: Boolean(integration),
        messages,
        employees,
        hrUsers,
        categoryCounts: Object.fromEntries(
          counts.map((c) => [c.category, c._count])
        ),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
