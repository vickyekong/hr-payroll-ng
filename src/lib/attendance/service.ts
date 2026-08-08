import {
  addDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { prisma } from "@/lib/db";
import {
  DEFAULT_WORKING_DAYS_PER_MONTH,
  getDailyRateFromMonthly,
} from "@/lib/payroll/calculate-payroll";
import { ensurePayrollHardeningSchema } from "@/lib/ensure-payroll-hardening-schema";
import {
  combineDateAndTime,
  compileAttendanceStatus,
  isWorkDay,
  parseClockMachineCsv,
  shiftDurationMinutes,
  type ParsedPunchRow,
} from "@/lib/attendance/parse-clock-csv";
import { isAttendancePenaltyExempt, isShiftAttendanceExempt } from "@/lib/attendance/penalty-exempt";
import { deviceMatchKeys } from "@/lib/attendance/device-match";
import {
  ATTENDANCE_SHEET_NOTE_PREFIX,
  attendanceSheetNote,
  parseMonthlyAttendanceSheets,
  scoreEmployeeNameMatch,
  type ParsedSheetDay,
} from "@/lib/attendance/parse-attendance-sheet";

function dateKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function companyWorkingDays(companyId: string): Promise<number> {
  await ensurePayrollHardeningSchema();
  const config = await prisma.statutoryConfig.findUnique({
    where: { companyId },
    select: { workingDaysPerMonth: true } as { workingDaysPerMonth: true },
  }).catch(async () => {
    // Column may not be in generated client yet — raw fallback
    const rows = await prisma.$queryRawUnsafe<Array<{ workingDaysPerMonth: number }>>(
      `SELECT "workingDaysPerMonth" FROM "StatutoryConfig" WHERE "companyId" = $1 LIMIT 1`,
      companyId
    );
    return rows[0] ?? null;
  });
  const days =
    config &&
    typeof (config as { workingDaysPerMonth?: number }).workingDaysPerMonth ===
      "number"
      ? (config as { workingDaysPerMonth: number }).workingDaysPerMonth
      : DEFAULT_WORKING_DAYS_PER_MONTH;
  return Math.max(1, days);
}

/** Monday–Sunday week containing the given date (local). */
export function weekBounds(anchor: Date): { start: Date; end: Date } {
  const start = startOfWeek(startOfDay(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(startOfDay(anchor), { weekStartsOn: 1 });
  return { start, end };
}

async function buildEmployeeDeviceMap(companyId: string) {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      status: { in: ["ACTIVE", "ON_LEAVE", "SICK_LEAVE", "SUSPENDED"] },
    },
    select: {
      id: true,
      employeeCode: true,
      clockDeviceId: true,
    },
  });

  const byKey = new Map<string, string>();
  const employeeById = new Map(
    employees.map((e) => [e.id, e] as const)
  );

  for (const e of employees) {
    for (const key of deviceMatchKeys(e.employeeCode)) {
      if (!byKey.has(key)) byKey.set(key, e.id);
    }
    if (e.clockDeviceId) {
      for (const key of deviceMatchKeys(e.clockDeviceId)) {
        byKey.set(key, e.id);
      }
    }
  }

  return { byKey, employees, employeeById };
}

/**
 * Ensure a default Mon–Fri shift exists and is assigned to every non-exempt
 * active staff member who does not already have a shift.
 */
export async function ensureDefaultShiftCoverage(companyId: string) {
  let shift = await prisma.shiftTemplate.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  if (!shift) {
    shift = await prisma.shiftTemplate.create({
      data: {
        companyId,
        name: "Standard day",
        startTime: "08:00",
        endTime: "17:00",
        workDays: "1111100",
        graceMinutes: 15,
      },
    });
  }

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      status: { in: ["ACTIVE", "ON_LEAVE", "SICK_LEAVE", "SUSPENDED"] },
    },
    select: {
      id: true,
      department: true,
      jobTitle: true,
      shiftAssignment: { select: { employeeId: true } },
    },
  });

  const needAssign = employees.filter(
    (e) =>
      !isShiftAttendanceExempt(e.department, e.jobTitle) && !e.shiftAssignment
  );

  for (const chunk of chunkArray(needAssign, 50)) {
    await prisma.$transaction(
      chunk.map((e) =>
        prisma.employeeShiftAssignment.upsert({
          where: { employeeId: e.id },
          create: { employeeId: e.id, shiftId: shift!.id },
          update: {},
        })
      )
    );
  }

  return {
    shiftId: shift.id,
    shiftName: shift.name,
    assigned: needAssign.length,
  };
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

  const { byKey, employeeById } = await buildEmployeeDeviceMap(
    options.companyId
  );

  let imported = 0;
  let mapped = 0;
  let skipped = 0;
  const autoLinkedDeviceIds: string[] = [];

  for (const chunk of chunkArray(rows, 40)) {
    const ops = chunk.map((row) => {
      const keys = deviceMatchKeys(row.deviceUserId);
      let employeeId: string | null = null;
      for (const key of keys) {
        const hit = byKey.get(key);
        if (hit) {
          employeeId = hit;
          break;
        }
      }

      return { row, employeeId };
    });

    // Persist newly discovered clock IDs onto staff (best-effort, unique).
    for (const { row, employeeId } of ops) {
      if (!employeeId) continue;
      const emp = employeeById.get(employeeId);
      if (!emp || emp.clockDeviceId) continue;
      const deviceId = row.deviceUserId.trim();
      try {
        await prisma.employee.update({
          where: { id: employeeId },
          data: { clockDeviceId: deviceId },
        });
        emp.clockDeviceId = deviceId;
        for (const key of deviceMatchKeys(deviceId)) {
          byKey.set(key, employeeId);
        }
        autoLinkedDeviceIds.push(`${emp.employeeCode}→${deviceId}`);
      } catch {
        // unique clash — leave unset
      }
    }

    try {
      await prisma.$transaction(
        ops.map(({ row, employeeId }) =>
          prisma.attendancePunch.upsert({
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
          })
        )
      );
      imported += ops.length;
      mapped += ops.filter((o) => o.employeeId).length;
    } catch {
      // Fall back one-by-one for this chunk
      for (const { row, employeeId } of ops) {
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
    }
  }

  const nowYear = new Date().getFullYear();
  const plausible = rows
    .map((r) => r.punchedAt)
    .filter((d) => {
      const y = d.getFullYear();
      return y >= 2020 && y <= nowYear + 1;
    });
  const hintSource = plausible.length > 0 ? plausible : [];
  let periodHint: { month: number; year: number } | null = null;
  if (hintSource.length > 0) {
    // Prefer the most common calendar month among plausible punch dates
    const counts = new Map<string, number>();
    for (const d of hintSource) {
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = "";
    let bestN = 0;
    for (const [key, n] of counts) {
      if (n >= bestN) {
        best = key;
        bestN = n;
      }
    }
    const [y, m] = best.split("-").map(Number);
    periodHint = { year: y, month: m };
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
    autoLinkedDeviceIds: autoLinkedDeviceIds.slice(0, 30),
    periodHint,
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

/**
 * Import L'ORI / Arami monthly attendance sheets (day codes W/A/O/…) directly
 * into AttendanceDay — these are not punch logs.
 */
export async function importAttendanceSheetDays(options: {
  companyId: string;
  buffer: ArrayBuffer | Buffer;
  importBatch?: string;
}) {
  const parsed = parseMonthlyAttendanceSheets(options.buffer);
  if (!parsed.detected || parsed.days.length === 0) {
    return {
      format: "ATTENDANCE_SHEET" as const,
      detected: false as const,
      batch: options.importBatch ?? `sheet-${Date.now()}`,
      parsed: 0,
      imported: 0,
      mapped: 0,
      unmapped: 0,
      skipped: 0,
      employeesMatched: 0,
      unmatchedNames: [] as string[],
      sheetsParsed: [] as string[],
      parseErrors: parsed.errors,
      source: "ATTENDANCE_SHEET",
      periodHint: null as { month: number; year: number } | null,
      autoLinkedDeviceIds: [] as string[],
    };
  }

  await ensureDefaultShiftCoverage(options.companyId);

  const batch = options.importBatch ?? `sheet-${Date.now()}`;
  const employees = await prisma.employee.findMany({
    where: {
      companyId: options.companyId,
      status: { in: ["ACTIVE", "ON_LEAVE", "SICK_LEAVE", "SUSPENDED"] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      basicSalaryKobo: true,
      department: true,
      jobTitle: true,
      shiftAssignment: { select: { shiftId: true } },
    },
  });

  const settings = await prisma.attendanceSettings.upsert({
    where: { companyId: options.companyId },
    create: { companyId: options.companyId },
    update: {},
  });

  const defaultShift = await prisma.shiftTemplate.findFirst({
    where: { companyId: options.companyId },
    orderBy: { createdAt: "asc" },
  });

  function matchEmployee(name: string) {
    let best: (typeof employees)[number] | null = null;
    let bestScore = 0;
    for (const emp of employees) {
      const score = scoreEmployeeNameMatch(
        name,
        emp.firstName,
        emp.lastName
      );
      if (score > bestScore) {
        bestScore = score;
        best = emp;
      }
    }
    if (!best || bestScore < 0.55) return null;
    return { employee: best, score: bestScore };
  }

  const byName = new Map<string, ParsedSheetDay[]>();
  for (const day of parsed.days) {
    const list = byName.get(day.employeeName) ?? [];
    list.push(day);
    byName.set(day.employeeName, list);
  }

  const unmatchedNames: string[] = [];
  const matchedNameToId = new Map<string, string>();
  for (const name of byName.keys()) {
    const hit = matchEmployee(name);
    if (!hit) {
      unmatchedNames.push(name);
      continue;
    }
    matchedNameToId.set(name, hit.employee.id);
  }

  // Replace prior sheet days for the months covered
  const monthKeys = new Set<string>();
  for (const d of parsed.days) {
    monthKeys.add(`${d.workDate.getFullYear()}-${d.workDate.getMonth() + 1}`);
  }
  for (const key of monthKeys) {
    const [y, m] = key.split("-").map(Number);
    const start = startOfMonth(new Date(y, m - 1, 1));
    const end = endOfMonth(start);
    await prisma.attendanceDay.deleteMany({
      where: {
        companyId: options.companyId,
        workDate: { gte: start, lte: end },
        notes: { startsWith: ATTENDANCE_SHEET_NOTE_PREFIX },
      },
    });
  }

  const expectedMinutes = defaultShift
    ? shiftDurationMinutes(defaultShift.startTime, defaultShift.endTime)
    : 480;

  type DayRecord = {
    companyId: string;
    employeeId: string;
    workDate: Date;
    shiftId: string | null;
    status: ParsedSheetDay["status"];
    clockInAt: Date | null;
    clockOutAt: Date | null;
    workedMinutes: number;
    lateMinutes: number;
    expectedMinutes: number;
    penaltyKobo: bigint;
    notes: string;
    compiledAt: Date;
  };

  const records: DayRecord[] = [];
  const now = new Date();
  const seen = new Set<string>();
  const workingDays = await companyWorkingDays(options.companyId);

  for (const [name, days] of byName) {
    const employeeId = matchedNameToId.get(name);
    if (!employeeId) continue;
    const emp = employees.find((e) => e.id === employeeId)!;
    const penaltyExempt = isAttendancePenaltyExempt(
      emp.department,
      emp.jobTitle
    );

    for (const day of days) {
      const workDate = startOfDay(day.workDate);
      const uniq = `${employeeId}|${dateKey(workDate)}`;
      if (seen.has(uniq)) continue;
      seen.add(uniq);

      // Skip quiet off days to keep the report focused (still keep absences)
      if (day.status === "OFF") continue;

      let penaltyKobo = 0n;
      if (day.penalize && !penaltyExempt) {
        penaltyKobo =
          settings.missedShiftPenaltyKobo > 0n
            ? settings.missedShiftPenaltyKobo
            : getDailyRateFromMonthly(emp.basicSalaryKobo, workingDays);
      }

      let workedMinutes = 0;
      if (day.status === "PRESENT") workedMinutes = expectedMinutes;
      else if (day.status === "PARTIAL") {
        workedMinutes = Math.floor(expectedMinutes / 2);
      }

      records.push({
        companyId: options.companyId,
        employeeId,
        workDate,
        shiftId: emp.shiftAssignment?.shiftId ?? defaultShift?.id ?? null,
        status: day.status,
        clockInAt: null,
        clockOutAt: null,
        workedMinutes,
        lateMinutes: 0,
        expectedMinutes: day.status === "OFF" ? 0 : expectedMinutes,
        penaltyKobo,
        notes: attendanceSheetNote(day.code),
        compiledAt: now,
      });
    }
  }

  let imported = 0;
  for (const chunk of chunkArray(records, 200)) {
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.attendanceDay.upsert({
          where: {
            employeeId_workDate: {
              employeeId: row.employeeId,
              workDate: row.workDate,
            },
          },
          create: row,
          update: {
            shiftId: row.shiftId ?? undefined,
            status: row.status,
            clockInAt: row.clockInAt,
            clockOutAt: row.clockOutAt,
            workedMinutes: row.workedMinutes,
            lateMinutes: row.lateMinutes,
            expectedMinutes: row.expectedMinutes,
            penaltyKobo: row.penaltyKobo,
            notes: row.notes,
            compiledAt: row.compiledAt,
          },
        })
      )
    );
    imported += chunk.length;
  }

  const topPeriod = (() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      const key = `${r.workDate.getFullYear()}-${r.workDate.getMonth() + 1}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best: { month: number; year: number; n: number } | null = null;
    for (const [key, n] of counts) {
      const [year, month] = key.split("-").map(Number);
      if (!best || n > best.n) best = { month, year, n };
    }
    return best;
  })();
  const periodHint = topPeriod
    ? { month: topPeriod.month, year: topPeriod.year }
    : parsed.periodHints[0]
      ? {
          month: parsed.periodHints[0].month,
          year: parsed.periodHints[0].year,
        }
      : null;

  return {
    format: "ATTENDANCE_SHEET" as const,
    detected: true as const,
    batch,
    parsed: parsed.days.length,
    imported,
    mapped: imported,
    unmapped: 0,
    skipped: parsed.days.length - imported,
    employeesMatched: matchedNameToId.size,
    unmatchedNames: unmatchedNames.slice(0, 40),
    sheetsParsed: parsed.sheetsParsed,
    parseErrors: parsed.errors,
    source: "ATTENDANCE_SHEET",
    periodHint,
    periodHints: parsed.periodHints,
    autoLinkedDeviceIds: [] as string[],
    absentDays: records.filter((r) => r.status === "ABSENT").length,
  };
}

export async function compileAttendancePeriod(options: {
  companyId: string;
  periodMonth?: number;
  periodYear?: number;
  /** Inclusive local date range override (e.g. a week). */
  periodStart?: Date;
  periodEnd?: Date;
}) {
  await ensureDefaultShiftCoverage(options.companyId);

  let periodStart: Date;
  let periodEnd: Date;
  if (options.periodStart && options.periodEnd) {
    periodStart = startOfDay(options.periodStart);
    periodEnd = startOfDay(options.periodEnd);
  } else if (options.periodMonth && options.periodYear) {
    periodStart = startOfMonth(
      new Date(options.periodYear, options.periodMonth - 1, 1)
    );
    periodEnd = endOfMonth(periodStart);
  } else {
    throw new Error("Provide month/year or a start/end date range");
  }

  if (periodEnd < periodStart) {
    throw new Error("periodEnd must be on or after periodStart");
  }

  const workingDays = await companyWorkingDays(options.companyId);

  const [settings, employees, punches, leaveRequests, sheetDays] =
    await Promise.all([
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
    prisma.attendanceDay.findMany({
      where: {
        companyId: options.companyId,
        workDate: { gte: periodStart, lte: periodEnd },
        notes: { startsWith: ATTENDANCE_SHEET_NOTE_PREFIX },
      },
      select: { employeeId: true, workDate: true },
    }),
  ]);

  const sheetDayKeys = new Set(
    sheetDays.map((d) => `${d.employeeId}|${dateKey(d.workDate)}`)
  );

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

  const regulated = employees.filter(
    (e) =>
      !isShiftAttendanceExempt(e.department, e.jobTitle) &&
      e.shiftAssignment?.shift
  );
  const exemptIds = employees
    .filter((e) => isShiftAttendanceExempt(e.department, e.jobTitle))
    .map((e) => e.id);

  type DayRecord = {
    companyId: string;
    employeeId: string;
    workDate: Date;
    shiftId: string;
    status: "PRESENT" | "LATE" | "PARTIAL" | "ABSENT" | "ON_LEAVE" | "OFF";
    clockInAt: Date | null;
    clockOutAt: Date | null;
    workedMinutes: number;
    lateMinutes: number;
    expectedMinutes: number;
    penaltyKobo: bigint;
    compiledAt: Date;
  };

  const records: DayRecord[] = [];
  let absentCount = 0;
  let penaltyTotalKobo = 0n;
  const now = new Date();

  for (const employee of regulated) {
    const shift = employee.shiftAssignment!.shift;
    const empPunches = punchesByEmployee.get(employee.id) ?? [];
    const leaves = leaveByEmployee.get(employee.id) ?? [];

    for (
      let day = startOfDay(periodStart);
      day <= periodEnd;
      day = addDays(day, 1)
    ) {
      // Prefer L'ORI attendance-sheet days over punch-derived scores
      if (sheetDayKeys.has(`${employee.id}|${dateKey(day)}`)) {
        continue;
      }

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
        clockInAt = (ins[0] ?? dayPunches[0])?.punchedAt ?? null;
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
      const expectedMinutes = shiftDurationMinutes(
        shift.startTime,
        shift.endTime
      );
      const grace = shift.graceMinutes || settings.lateGraceMinutes;

      const compiled = compileAttendanceStatus({
        expected,
        onLeave,
        clockInAt,
        clockOutAt:
          clockOutAt && clockInAt && clockOutAt > clockInAt
            ? clockOutAt
            : null,
        shiftStart,
        graceMinutes: grace,
        minPresentMinutes: settings.minPresentMinutes,
        expectedMinutes,
      });

      let penaltyKobo = 0n;
      if (compiled.status === "ABSENT") {
        absentCount += 1;
        const penaltyExempt = isAttendancePenaltyExempt(
          employee.department,
          employee.jobTitle
        );
        if (!penaltyExempt) {
          if (settings.missedShiftPenaltyKobo > 0n) {
            penaltyKobo = settings.missedShiftPenaltyKobo;
          } else {
            penaltyKobo = getDailyRateFromMonthly(
              employee.basicSalaryKobo,
              workingDays
            );
          }
          penaltyTotalKobo += penaltyKobo;
        }
      }

      // Skip quiet OFF days with no punches to keep writes small
      if (compiled.status === "OFF" && dayPunches.length === 0) {
        continue;
      }

      records.push({
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
        compiledAt: now,
      });
    }
  }

  const regulatedIds = regulated.map((e) => e.id);
  if (regulatedIds.length > 0) {
    await prisma.attendanceDay.deleteMany({
      where: {
        companyId: options.companyId,
        employeeId: { in: regulatedIds },
        workDate: { gte: periodStart, lte: periodEnd },
        NOT: { notes: { startsWith: ATTENDANCE_SHEET_NOTE_PREFIX } },
      },
    });
  }

  for (const chunk of chunkArray(records, 250)) {
    await prisma.attendanceDay.createMany({ data: chunk });
  }

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
    daysCompiled: records.length,
    staffCompiled: regulated.length,
    absentCount,
    penaltyTotalKobo: penaltyTotalKobo.toString(),
    punchesUsed: punches.length,
    period: {
      month: periodStart.getMonth() + 1,
      year: periodStart.getFullYear(),
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
          jobTitle: true,
        },
      },
    },
  });

  const penalizableDays = absentDays.filter(
    (day) =>
      !isAttendancePenaltyExempt(
        day.employee.department,
        day.employee.jobTitle
      )
  );

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
        description: `Missed ${agg.days} shift${agg.days === 1 ? "" : "s"} from clock attendance (${run.periodMonth}/${run.periodYear})`,
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
    penaltyTotalKobo: [...byEmployee.values()]
      .reduce((s, a) => s + a.amount, 0n)
      .toString(),
    adjustments: created,
  };
}

/**
 * Compile clock attendance for the payroll month, then apply missed-shift
 * deductions so salary calculation reflects present/absent days.
 */
export async function syncAttendanceIntoPayroll(options: {
  companyId: string;
  payrollRunId: string;
}) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: options.payrollRunId, companyId: options.companyId },
    select: {
      id: true,
      status: true,
      periodMonth: true,
      periodYear: true,
    },
  });
  if (!run) throw new Error("Payroll run not found");
  if (run.status !== "DRAFT") {
    throw new Error("Can only sync attendance into draft payroll runs");
  }

  const compiled = await compileAttendancePeriod({
    companyId: options.companyId,
    periodMonth: run.periodMonth,
    periodYear: run.periodYear,
  });

  const penalties = await applyAttendancePenaltiesToPayroll({
    companyId: options.companyId,
    payrollRunId: run.id,
  });

  return { compiled, penalties };
}
