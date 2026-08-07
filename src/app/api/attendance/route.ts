import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { startOfMonth, endOfMonth } from "date-fns";
import { serializeBigInts } from "@/lib/payroll/config-mapper";
import { isShiftAttendanceExempt } from "@/lib/attendance/penalty-exempt";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("manageAttendance");
    const { searchParams } = new URL(req.url);
    const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
    const year = Number(searchParams.get("year") ?? new Date().getFullYear());
    const status = searchParams.get("status");

    const periodStart = startOfMonth(new Date(year, month - 1, 1));
    const periodEnd = endOfMonth(periodStart);

    const [settings, shifts, allDays, unmappedPunches, employeesMissingDevice] =
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
          take: 5000,
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

    const regulatedDays = allDays.filter(
      (d) => !isShiftAttendanceExempt(d.employee.department)
    );

    const days = status
      ? regulatedDays.filter((d) => d.status === status)
      : regulatedDays;

    const summary = {
      present: regulatedDays.filter((d) => d.status === "PRESENT").length,
      late: regulatedDays.filter((d) => d.status === "LATE").length,
      partial: regulatedDays.filter((d) => d.status === "PARTIAL").length,
      absent: regulatedDays.filter((d) => d.status === "ABSENT").length,
      onLeave: regulatedDays.filter((d) => d.status === "ON_LEAVE").length,
      off: regulatedDays.filter((d) => d.status === "OFF").length,
      penaltyKobo: regulatedDays
        .reduce((sum, d) => sum + d.penaltyKobo, 0n)
        .toString(),
    };

    const staffMap = new Map<
      string,
      {
        id: string;
        employeeCode: string;
        name: string;
        department: string;
        clockDeviceId: string | null;
        present: number;
        late: number;
        partial: number;
        absent: number;
        onLeave: number;
        scheduledDays: number;
        penaltyKobo: bigint;
      }
    >();

    for (const day of regulatedDays) {
      if (day.status === "OFF") continue;
      const key = day.employee.id;
      const row = staffMap.get(key) ?? {
        id: day.employee.id,
        employeeCode: day.employee.employeeCode,
        name: `${day.employee.firstName} ${day.employee.lastName}`,
        department: day.employee.department,
        clockDeviceId: day.employee.clockDeviceId,
        present: 0,
        late: 0,
        partial: 0,
        absent: 0,
        onLeave: 0,
        scheduledDays: 0,
        penaltyKobo: 0n,
      };
      row.scheduledDays += 1;
      if (day.status === "PRESENT") row.present += 1;
      if (day.status === "LATE") row.late += 1;
      if (day.status === "PARTIAL") row.partial += 1;
      if (day.status === "ABSENT") row.absent += 1;
      if (day.status === "ON_LEAVE") row.onLeave += 1;
      row.penaltyKobo += day.penaltyKobo;
      staffMap.set(key, row);
    }

    const staffSummary = Array.from(staffMap.values())
      .map((s) => ({
        ...s,
        attendanceRate:
          s.scheduledDays - s.onLeave > 0
            ? Math.round(
                ((s.present + s.late + s.partial) /
                  (s.scheduledDays - s.onLeave)) *
                  100
              )
            : null,
        penaltyKobo: s.penaltyKobo.toString(),
      }))
      .sort(
        (a, b) =>
          b.absent - a.absent || a.employeeCode.localeCompare(b.employeeCode)
      );

    const deptAbsent = new Map<string, number>();
    for (const s of staffSummary) {
      if (s.absent > 0) {
        deptAbsent.set(
          s.department || "Unassigned",
          (deptAbsent.get(s.department || "Unassigned") ?? 0) + s.absent
        );
      }
    }

    const charts = {
      byStatus: [
        { key: "PRESENT", name: "Present", value: summary.present },
        { key: "LATE", name: "Late", value: summary.late },
        { key: "PARTIAL", name: "Partial", value: summary.partial },
        { key: "ABSENT", name: "Absent", value: summary.absent },
        { key: "ON_LEAVE", name: "On leave", value: summary.onLeave },
      ].filter((c) => c.value > 0),
      byDepartmentAbsent: Array.from(deptAbsent.entries())
        .map(([name, value]) => ({ key: name, name, value }))
        .sort((a, b) => b.value - a.value),
      byStaffOutcome: [
        {
          key: "PERFECT",
          name: "Perfect attendance",
          value: staffSummary.filter(
            (s) =>
              s.absent === 0 &&
              s.late === 0 &&
              s.partial === 0 &&
              s.present > 0
          ).length,
        },
        {
          key: "LATE_ONLY",
          name: "Late / partial only",
          value: staffSummary.filter(
            (s) => s.absent === 0 && (s.late > 0 || s.partial > 0)
          ).length,
        },
        {
          key: "HAS_ABSENT",
          name: "Missed shift(s)",
          value: staffSummary.filter((s) => s.absent > 0).length,
        },
        {
          key: "LEAVE_ONLY",
          name: "On leave only",
          value: staffSummary.filter(
            (s) =>
              s.absent === 0 &&
              s.late === 0 &&
              s.partial === 0 &&
              s.present === 0 &&
              s.onLeave > 0
          ).length,
        },
      ].filter((c) => c.value > 0),
    };

    return NextResponse.json(
      serializeBigInts({
        period: { month, year },
        settings,
        shifts,
        summary,
        charts,
        staffSummary,
        unmappedPunches,
        employeesMissingDevice,
        days: days.slice(0, 500),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
