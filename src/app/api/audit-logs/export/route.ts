import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { buildCsv, csvResponse } from "@/lib/reports/csv";

function monthBounds(month: string): { from: Date; to: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { from, to };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("exportAuditLog");
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const entityType = searchParams.get("entityType") ?? undefined;

    let from: Date;
    let to: Date;
    let label: string;

    if (month) {
      const bounds = monthBounds(month);
      if (!bounds) {
        return Response.json(
          { error: "month must be YYYY-MM" },
          { status: 400 }
        );
      }
      from = bounds.from;
      to = bounds.to;
      label = month;
    } else if (fromParam && toParam) {
      from = new Date(fromParam);
      to = new Date(toParam);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return Response.json(
          { error: "Invalid from/to dates" },
          { status: 400 }
        );
      }
      label = `${fromParam.slice(0, 10)}_to_${toParam.slice(0, 10)}`;
    } else {
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      const bounds = monthBounds(`${y}-${m}`)!;
      from = bounds.from;
      to = bounds.to;
      label = `${y}-${m}`;
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: session.user.companyId,
        timestamp: { gte: from, lt: to },
        ...(entityType ? { entityType } : {}),
      },
      include: {
        performedBy: {
          select: { name: true, email: true, role: true },
        },
      },
      orderBy: { timestamp: "asc" },
      take: 10_000,
    });

    const csv = buildCsv(
      [
        "timestamp",
        "user_name",
        "user_email",
        "user_role",
        "action",
        "entity_type",
        "entity_id",
        "changes",
      ],
      logs.map((log) => [
        log.timestamp.toISOString(),
        log.performedBy.name,
        log.performedBy.email,
        log.performedBy.role,
        log.action,
        log.entityType,
        log.entityId,
        log.changes ? JSON.stringify(log.changes) : "",
      ])
    );

    return csvResponse(csv, `audit-log-${label}.csv`);
  } catch (error) {
    return handleApiError(error);
  }
}
