import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { serializeBigInts } from "@/lib/payroll/config-mapper";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("manageLeave");
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const id = searchParams.get("id");

    if (id) {
      const message = await prisma.hrDeskMessage.findFirst({
        where: { id, companyId: session.user.companyId },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
        },
      });
      if (!message) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(serializeBigInts(message));
    }

    const [messages, integration, employees, counts] = await Promise.all([
      prisma.hrDeskMessage.findMany({
        where: {
          companyId: session.user.companyId,
          ...(category ? { category: category as never } : {}),
          ...(status ? { status: status as never } : {}),
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
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
        categoryCounts: Object.fromEntries(
          counts.map((c) => [c.category, c._count])
        ),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
