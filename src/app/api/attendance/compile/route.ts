import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  compileAttendancePeriod,
  weekBounds,
} from "@/lib/attendance/service";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z
  .object({
    month: z.number().min(1).max(12).optional(),
    year: z.number().min(2020).optional(),
    /** ISO date (YYYY-MM-DD) anywhere in the week to analyse (Mon–Sun). */
    weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .superRefine((body, ctx) => {
    const hasMonth = body.month != null && body.year != null;
    const hasWeek = Boolean(body.weekOf);
    const hasRange = Boolean(body.from && body.to);
    if (!hasMonth && !hasWeek && !hasRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide month+year, weekOf, or from+to",
      });
    }
  });

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageAttendance");
    const body = bodySchema.parse(await req.json());

    let result;
    if (body.weekOf) {
      const { start, end } = weekBounds(parseLocalDate(body.weekOf));
      result = await compileAttendancePeriod({
        companyId: session.user.companyId,
        periodStart: start,
        periodEnd: end,
      });
    } else if (body.from && body.to) {
      result = await compileAttendancePeriod({
        companyId: session.user.companyId,
        periodStart: parseLocalDate(body.from),
        periodEnd: parseLocalDate(body.to),
      });
    } else {
      result = await compileAttendancePeriod({
        companyId: session.user.companyId,
        periodMonth: body.month!,
        periodYear: body.year!,
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "COMPILE",
        entityType: "AttendanceDay",
        entityId: `${result.period.from}_${result.period.to}`,
        performedById: session.user.id,
        changes: result,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
