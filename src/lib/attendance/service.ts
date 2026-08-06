import { addDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import { getDailyRateFromMonthly } from "@/lib/payroll/calculate-payroll";
import {
  combineDateAndTime,
  compileAttendanceStatus,
  isWorkDay,
  parseClockMachineCsv,
  shiftDurationMinutes,
  type ParsedPunchRow,
} from "@/lib/attendance/parse-clock-csv";
import { isShiftAttendanceExempt } from "@/lib/attendance/penalty-exempt";

function dateKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

export async function importPunches(options: {
  companyId: string;
  rows: ParsedPunchRow[];
  parseErrors?: string[];
  source?: string;
  importBatch?: string;
}) {
  const rows = options.rows;
  const errors = options.parseErrors ?? [];
  const batch = options.importBatch ?? `imp_${Date.now()}`;
  const source = options.source ?? "CSV_IMPORT";

  const employees = await prisma.employee.findMany({
    where: { companyId: options.companyId, clockDeviceId: { not: null } },
    select: { id: true, clockDeviceId: true },
  });
  const byDevice = new Map(
    employees
      .filter((e) => e.clockDeviceId)
      .map((e) => [e.clockDeviceId!.replace(/^0+/, "") || e.clockDeviceId!, e.id])
  );
  // also map raw ids without stripping
  for (const e of employees) {
    if (e.clockDeviceId) byDevice.set(e.clockDeviceId, e.id);
  }

  let imported = 0;
  let mapped = 0;
  let skipped = 0;

  for (const row of rows) {
    const normalizedId = row.deviceUserId.replace(/^0+/, "") || row.deviceUserId;
    const employeeId =
      byDevice.get(row.deviceUserId) ?? byDevice.get(normalizedId) ?? null;

    try {
      await prisma.attendancePunch.upsert({
        where: {
          companyId_deviceUserId_punchedAt: {
            companyId: options.companyId,
            deviceUserId: row.deviceUserId,
            punchedAt: row.punchedAt,
          },
        },
        create: {
          companyId: options.companyId,
          deviceUserId: row.deviceUserId,
          employeeId,
          punchedAt: row.punchedAt,
          punchType: row.punchType,
          source,
          importBatch: batch,
          rawLine: row.rawLine,
        },
        update: {
          employeeId: employeeId ?? undefined,
          punchType: row.punchType ?? undefined,
        },
      });
      imported += 1;
      if (employeeId) mapped += 1;
    } catch {
      skipped += 1;
    }
  }

  return {
    batch,
    parsed: rows.length,
    imported,
    mapped,
    unmapped: imported - mapped,
    skipped,
    parseErrors: errors.slice(0, 20),
    source,
  };
}

export async function importPunchesFromCsv(options: {
  companyId: string;
  csvText: string;
  importBatch?: string;
}) {
  const { rows, errors } = parseClockMachineCsv(options.csvText);
  return importPunches({
    companyId: options.companyId,
    rows,
    parseErrors: errors,
    source: "CSV_IMPORT",
    importBatch: options.importBatch,
  });
}

export async function compileAttendancePeriod(options: {
  companyId: string;
  periodMonth: number;
  periodYear: number;
}) {
  const periodStart = startOfMonth(
    new Date(options.periodYear, options.periodMonth - 1, 1)
  );
  const periodEnd = endOfMonth(periodStart);

  const [settings, employees, punches, leaveRequests] = await Promise.all([
    prisma.attendanceSettings.upsert({
      where: { companyId: options.companyId },
      create: { companyId: options.companyId },
      update: {},
    }),
    prisma.employee.findMany({
      where: {
        companyId: options.companyId,
        status: { in: ["ACTIVE", "ON_LEAVE", "SICK_LEAVE", "SUSPENDED"] },
      },
      include: {
        shiftAssignment: { include: { shift: true } },
      },
    }),
    prisma.attendancePunch.findMany({
      where: {
        companyId: options.companyId,
        punchedAt: { gte: periodStart, lte: endOfDay(periodEnd) },
        employeeId: { not: null },
      },
      orderBy: { punchedAt: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        employee: { companyId: options.companyId },
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
  ]);

  const punchesByEmployee = new Map<string, typeof punches>();
  for (const p of punches) {
    if (!p.employeeId) continue;
    const list = punchesByEmployee.get(p.employeeId) ?? [];
    list.push(p);
    punchesByEmployee.set(p.employeeId, list);
  }

  const leaveByEmployee = new Map<string, typeof leaveRequests>();
  for (const l of leaveRequests) {
    const list = leaveByEmployee.get(l.employeeId) ?? [];
    list.push(l);
    leaveByEmployee.set(l.employeeId, list);
  }

  let upserted = 0;
  let absentCount = 0;
  let penaltyTotalKobo = 0n;

  for (const employee of employees) {
    // Management is not shift-regulated — skip compile and clear any prior day scores.
    if (isShiftAttendanceExempt(employee.department)) {
      continue;
    }

    const shift = employee.shiftAssignment?.shift;
    if (!shift) continue;

    const empPunches = punchesByEmployee.get(employee.id) ?? [];
    const leaves = leaveByEmployee.get(employee.id) ?? [];

    for (
      let day = startOfDay(periodStart);
      day <= periodEnd;
      day = addDays(day, 1)
    ) {
      const expected = isWorkDay(shift.workDays, day);
      const onLeave = leaves.some(
        (l) =>
          startOfDay(l.startDate) <= day && startOfDay(l.endDate) >= day
      );

      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const dayPunches = empPunches.filter(
        (p) => p.punchedAt >= dayStart && p.punchedAt <= dayEnd
      );

      let clockInAt: Date | null = null;
      let clockOutAt: Date | null = null;

      if (dayPunches.length > 0) {
        const ins = dayPunches.filter((p) => p.punchType === "IN");
        const outs = dayPunches.filter((p) => p.punchType === "OUT");
        clockInAt =
          (ins[0] ?? dayPunches[0])?.punchedAt ?? null;
        clockOutAt =
          (outs[outs.length - 1] ?? dayPunches[dayPunches.length - 1])
            ?.punchedAt ?? null;
        if (clockInAt && clockOutAt && clockOutAt <= clockInAt) {
          clockOutAt =
            dayPunches.length > 1
              ? dayPunches[dayPunches.length - 1].punchedAt
              : null;
        }
      }

      const shiftStart = combineDateAndTime(day, shift.startTime);
      const expectedMinutes = shiftDurationMinutes(shift.startTime, shift.endTime);
      const grace = shift.graceMinutes || settings.lateGraceMinutes;

      const compiled = compileAttendanceStatus({
        expected,
        onLeave,
        clockInAt,
        clockOutAt:
          clockOutAt && clockInAt && clockOutAt > clockInAt ? clockOutAt : null,
        shiftStart,
        graceMinutes: grace,
        minPresentMinutes: settings.minPresentMinutes,
        expectedMinutes,
      });

      let penaltyKobo = 0n;
      if (compiled.status === "ABSENT") {
        absentCount += 1;
        if (settings.missedShiftPenaltyKobo > 0n) {
          penaltyKobo = settings.missedShiftPenaltyKobo;
        } else {
          penaltyKobo = getDailyRateFromMonthly(employee.basicSalaryKobo);
        }
        penaltyTotalKobo += penaltyKobo;
      }

      await prisma.attendanceDay.upsert({
        where: {
          employeeId_workDate: {
            employeeId: employee.id,
            workDate: dayStart,
          },
        },
        create: {
          companyId: options.companyId,
          employeeId: employee.id,
          workDate: dayStart,
          shiftId: shift.id,
          status: compiled.status,
          clockInAt,
          clockOutAt:
            clockOutAt && clockInAt && clockOutAt > clockInAt
              ? clockOutAt
              : null,
          workedMinutes: compiled.workedMinutes,
          lateMinutes: compiled.lateMinutes,
          expectedMinutes,
          penaltyKobo,
          compiledAt: new Date(),
        },
        update: {
          shiftId: shift.id,
          status: compiled.status,
          clockInAt,
          clockOutAt:
            clockOutAt && clockInAt && clockOutAt > clockInAt
              ? clockOutAt
              : null,
          workedMinutes: compiled.workedMinutes,
          lateMinutes: compiled.lateMinutes,
          expectedMinutes,
          penaltyKobo,
          compiledAt: new Date(),
        },
      });
      upserted += 1;
    }
  }

  // Drop shift scores / assignments for Management (not shift-regulated).
  const exemptIds = employees
    .filter((e) => isShiftAttendanceExempt(e.department))
    .map((e) => e.id);
  if (exemptIds.length > 0) {
    await prisma.attendanceDay.deleteMany({
      where: {
        companyId: options.companyId,
        employeeId: { in: exemptIds },
        workDate: { gte: periodStart, lte: periodEnd },
      },
    });
    await prisma.employeeShiftAssignment.deleteMany({
      where: { employeeId: { in: exemptIds } },
    });
  }

  return {
    daysCompiled: upserted,
    absentCount,
    penaltyTotalKobo: penaltyTotalKobo.toString(),
    period: {
      month: options.periodMonth,
      year: options.periodYear,
      from: dateKey(periodStart),
      to: dateKey(periodEnd),
    },
  };
}

/** Push missed-shift penalties into a draft payroll run as ATTENDANCE_PENALTY adjustments. */
export async function applyAttendancePenaltiesToPayroll(options: {
  companyId: string;
  payrollRunId: string;
}) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: options.payrollRunId, companyId: options.companyId },
  });
  if (!run) throw new Error("Payroll run not found");
  if (run.status !== "DRAFT") {
    throw new Error("Can only apply attendance penalties to draft payroll runs");
  }

  const periodStart = startOfMonth(
    new Date(run.periodYear, run.periodMonth - 1, 1)
  );
  const periodEnd = endOfMonth(periodStart);

  const absentDays = await prisma.attendanceDay.findMany({
    where: {
      companyId: options.companyId,
      workDate: { gte: periodStart, lte: periodEnd },
      status: "ABSENT",
      penaltyKobo: { gt: 0 },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          department: true,
        },
      },
    },
  });

  const penalizableDays = absentDays.filter(
    (day) => !isShiftAttendanceExempt(day.employee.department)
  );

  // Remove previous auto attendance penalties for this run
  await prisma.payrollAdjustment.deleteMany({
    where: {
      payrollRunId: run.id,
      type: "ATTENDANCE_PENALTY",
    },
  });

  const byEmployee = new Map<
    string,
    { amount: bigint; days: number; code: string; name: string }
  >();

  for (const day of penalizableDays) {
    const current = byEmployee.get(day.employeeId) ?? {
      amount: 0n,
      days: 0,
      code: day.employee.employeeCode,
      name: `${day.employee.firstName} ${day.employee.lastName}`,
    };
    current.amount += day.penaltyKobo;
    current.days += 1;
    byEmployee.set(day.employeeId, current);
  }

  const created = [];
  for (const [employeeId, agg] of byEmployee) {
    const row = await prisma.payrollAdjustment.create({
      data: {
        payrollRunId: run.id,
        employeeId,
        type: "ATTENDANCE_PENALTY",
        amountKobo: -agg.amount,
        description: `Missed ${agg.days} shift${agg.days === 1 ? "" : "s"} (${run.periodMonth}/${run.periodYear})`,
      },
    });
    created.push({
      employeeId,
      employeeCode: agg.code,
      name: agg.name,
      missedShifts: agg.days,
      penaltyKobo: agg.amount.toString(),
      adjustmentId: row.id,
    });
  }

  return {
    employeesPenalized: created.length,
    missedShiftDays: penalizableDays.length,
    adjustments: created,
  };
}
