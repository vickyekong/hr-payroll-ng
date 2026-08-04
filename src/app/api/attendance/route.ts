import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { startOfMonth, endOfMonth } from "date-fns";
import { serializeBigInts } from "@/lib/payroll/config-mapper";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const { searchParams } = new URL(req.url);
    const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
    const year = Number(searchParams.get("year") ?? new Date().getFullYear());
    const status = searchParams.get("status");

    const periodStart = startOfMonth(new Date(year, month - 1, 1));
    const periodEnd = endOfMonth(periodStart);

    const [settings, shifts, days, unmappedPunches, employeesMissingDevice] =
      await Promise.all([
        prisma.attendanceSettings.upsert({
          where: { companyId: session.user.companyId },
          create: { companyId: session.user.companyId },
          update: {},
        }),
        prisma.shiftTemplate.findMany({
          where: { companyId: session.user.companyId },
          orderBy: { name: "asc" },
          include: { _count: { select: { assignments: true } } },
        }),
        prisma.attendanceDay.findMany({
          where: {
            companyId: session.user.companyId,
            workDate: { gte: periodStart, lte: periodEnd },
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
                clockDeviceId: true,
              },
            },
            shift: { select: { name: true, startTime: true, endTime: true } },
          },
          orderBy: [{ workDate: "desc" }, { employee: { employeeCode: "asc" } }],
          take: 500,
        }),
        prisma.attendancePunch.count({
          where: {
            companyId: session.user.companyId,
            employeeId: null,
            punchedAt: { gte: periodStart, lte: periodEnd },
          },
        }),
        prisma.employee.count({
          where: {
            companyId: session.user.companyId,
            status: "ACTIVE",
            OR: [{ clockDeviceId: null }, { clockDeviceId: "" }],
          },
        }),
      ]);

    const summary = {
      present: days.filter((d) => d.status === "PRESENT").length,
      late: days.filter((d) => d.status === "LATE").length,
      partial: days.filter((d) => d.status === "PARTIAL").length,
      absent: days.filter((d) => d.status === "ABSENT").length,
      onLeave: days.filter((d) => d.status === "ON_LEAVE").length,
      penaltyKobo: days
        .reduce((sum, d) => sum + d.penaltyKobo, 0n)
        .toString(),
    };

    return NextResponse.json(
      serializeBigInts({
        period: { month, year },
        settings,
        shifts,
        summary,
        unmappedPunches,
        employeesMissingDevice,
        days,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
