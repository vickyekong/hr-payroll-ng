import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { serializeBigInts } from "@/lib/payroll/config-mapper";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("viewAuditLog");
    const { searchParams } = new URL(req.url);

    const entityType = searchParams.get("entityType") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const cursor = searchParams.get("cursor") ?? undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: session.user.companyId,
        ...(entityType ? { entityType } : {}),
      },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { timestamp: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return NextResponse.json({
      logs: serializeBigInts(items),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
