import { startOfMonth, endOfMonth, differenceInMonths, subMonths } from "date-fns";
import { prisma } from "@/lib/db";
import { formatCurrency, getMonthName } from "@/lib/utils";
import {
  detectDepartmentPressure,
  detectEarlyAttritionRisk,
  detectLeaveSpike,
  riskSignalsToInsights,
  type DeptMonthStats,
  type RiskSignal,
} from "@/lib/intelligence/risk-signals";
import {
  displayName,
  isOmittedOrPlaceholderName,
  isPlaceholderLabel,
} from "@/lib/employees/data-quality";

export type InsightSeverity = "critical" | "watch" | "info" | "good";

export interface StaffInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  href?: string;
  metric?: string;
}

export interface StaffWatchItem {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  score: number;
  flags: string[];
  absentDays: number;
  lateDays: number;
  attendanceRate: number | null;
  pendingLeave: number;
  monthlyBasicNaira: number;
}

export interface DepartmentHealth {
  department: string;
  headcount: number;
  active: number;
  absentDays: number;
  avgAttendanceRate: number | null;
  payrollBasicKobo: string;
}

function scoreFlags(flags: string[]): number {
  let score = 0;
  for (const f of flags) {
    if (f.includes("omitted") || f.includes("placeholder")) score += 30;
    else if (f.includes("missed")) score += 25;
    else if (f.includes("late")) score += 10;
    else if (f.includes("leave")) score += 8;
    else if (f.includes("clock")) score += 12;
    else if (f.includes("shift")) score += 12;
    else if (f.includes("department") || f.includes("job title")) score += 10;
    else if (f.includes("suspended") || f.includes("sick")) score += 15;
    else score += 5;
  }
  return Math.min(100, score);
}

export async function getStaffIntelligence(companyId: string) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const periodStart = startOfMonth(new Date(year, month - 1, 1));
  const periodEnd = endOfMonth(periodStart);
  const priorStart = startOfMonth(subMonths(periodStart, 1));
  const priorEnd = endOfMonth(priorStart);

  const [employees, attendanceDays, priorAttendanceDays] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        department: true,
        status: true,
        sex: true,
        employmentType: true,
        startDate: true,
        clockDeviceId: true,
        basicSalaryKobo: true,
        housingAllowanceKobo: true,
        transportAllowanceKobo: true,
        shiftAssignment: { select: { shiftId: true } },
      },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.attendanceDay.findMany({
      where: {
        companyId,
        workDate: { gte: periodStart, lte: periodEnd },
        status: { not: "OFF" },
      },
      select: {
        employeeId: true,
        status: true,
        penaltyKobo: true,
      },
    }),
    prisma.attendanceDay.findMany({
      where: {
        companyId,
        workDate: { gte: priorStart, lte: priorEnd },
        status: { not: "OFF" },
      },
      select: {
        employeeId: true,
        status: true,
      },
    }),
  ]);

  const [
    pendingLeaveRows,
    leaveThisMonth,
    leavePriorMonth,
    latestPayroll,
    hrDeskOpen,
    departments,
  ] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        status: "PENDING",
        employee: { companyId },
      },
      select: { employeeId: true, type: true, days: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employee: { companyId },
        status: { in: ["APPROVED", "PENDING"] },
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      select: { employeeId: true, days: true, type: true, status: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employee: { companyId },
        status: { in: ["APPROVED", "PENDING"] },
        startDate: { lte: priorEnd },
        endDate: { gte: priorStart },
      },
      select: { employeeId: true },
    }),
    prisma.payrollRun.findFirst({
      where: { companyId, status: { in: ["APPROVED", "PAID"] } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: {
        payslips: {
          select: {
            employeeId: true,
            grossPayKobo: true,
            netPayKobo: true,
            payeKobo: true,
          },
        },
      },
    }),
    prisma.hrDeskMessage.count({
      where: {
        companyId,
        status: { in: ["NEW", "ASSIGNED", "TRIAGED"] },
      },
    }),
    prisma.department.findMany({
      where: { companyId },
      select: { name: true },
    }),
  ]);

  const attByEmp = new Map<
    string,
    { present: number; late: number; partial: number; absent: number; scheduled: number; penalty: bigint }
  >();
  for (const d of attendanceDays) {
    const row = attByEmp.get(d.employeeId) ?? {
      present: 0,
      late: 0,
      partial: 0,
      absent: 0,
      scheduled: 0,
      penalty: 0n,
    };
    row.scheduled += 1;
    if (d.status === "PRESENT") row.present += 1;
    if (d.status === "LATE") row.late += 1;
    if (d.status === "PARTIAL") row.partial += 1;
    if (d.status === "ABSENT") row.absent += 1;
    row.penalty += d.penaltyKobo;
    attByEmp.set(d.employeeId, row);
  }

  const pendingLeaveByEmp = new Map<string, number>();
  for (const l of pendingLeaveRows) {
    pendingLeaveByEmp.set(
      l.employeeId,
      (pendingLeaveByEmp.get(l.employeeId) ?? 0) + 1
    );
  }

  const active = employees.filter((e) => e.status === "ACTIVE");
  const insights: StaffInsight[] = [];
  const watchlist: StaffWatchItem[] = [];

  let totalAbsent = 0;
  let totalLate = 0;
  let totalPenalty = 0n;
  let staffWithAttendance = 0;
  let attendanceRateSum = 0;

  for (const e of employees) {
    const att = attByEmp.get(e.id);
    const flags: string[] = [];
    const absentDays = att?.absent ?? 0;
    const lateDays = (att?.late ?? 0) + (att?.partial ?? 0);
    const scheduled = att?.scheduled ?? 0;
    const onBooks =
      e.status === "ACTIVE" ||
      e.status === "ON_LEAVE" ||
      e.status === "SICK_LEAVE";

    let attendanceRate: number | null = null;
    if (att && scheduled > 0) {
      staffWithAttendance += 1;
      const worked = att.present + att.late + att.partial;
      attendanceRate = Math.round((worked / scheduled) * 100);
      attendanceRateSum += attendanceRate;
      totalAbsent += att.absent;
      totalLate += att.late + att.partial;
      totalPenalty += att.penalty;
    }

    if (onBooks && e.status === "ACTIVE" && !e.clockDeviceId) {
      flags.push("missing clock machine ID");
    }
    if (onBooks && e.status === "ACTIVE" && !e.shiftAssignment) {
      flags.push("no shift assigned");
    }
    if (isOmittedOrPlaceholderName(e.firstName)) {
      flags.push("omitted first name");
    }
    if (isOmittedOrPlaceholderName(e.lastName)) {
      flags.push("omitted last name");
    }
    if (isPlaceholderLabel(e.department)) {
      flags.push("department missing");
    }
    if (isPlaceholderLabel(e.jobTitle)) {
      flags.push("job title missing");
    }
    if (absentDays >= 3) flags.push(`${absentDays} missed shifts this month`);
    else if (absentDays > 0) flags.push(`${absentDays} missed shift(s)`);
    if (lateDays >= 5) flags.push(`${lateDays} late/partial days`);
    else if (lateDays >= 3) flags.push(`${lateDays} late days`);
    if ((pendingLeaveByEmp.get(e.id) ?? 0) > 0) {
      flags.push("pending leave request");
    }
    if (e.status === "SUSPENDED") flags.push("suspended");
    if (e.status === "SICK_LEAVE") flags.push("on sick leave");
    if (e.status === "ON_LEAVE") flags.push("on leave");
    if (!e.sex) flags.push("sex not set");

    const tenureMonths = differenceInMonths(now, e.startDate);
    if (onBooks && tenureMonths < 3) flags.push("new joiner (<3 months)");

    if (flags.length > 0 && e.status !== "FIRED") {
      watchlist.push({
        employeeId: e.id,
        employeeCode: e.employeeCode,
        name: displayName(e.firstName, e.lastName, e.employeeCode),
        department: e.department,
        score: scoreFlags(flags),
        flags,
        absentDays,
        lateDays,
        attendanceRate,
        pendingLeave: pendingLeaveByEmp.get(e.id) ?? 0,
        monthlyBasicNaira: Number(e.basicSalaryKobo) / 100,
      });
    }
  }

  watchlist.sort((a, b) => b.score - a.score);

  const avgAttendance =
    staffWithAttendance > 0
      ? Math.round(attendanceRateSum / staffWithAttendance)
      : null;

  const missingClock = active.filter((e) => !e.clockDeviceId).length;
  const missingShift = active.filter((e) => !e.shiftAssignment).length;
  const missingSex = employees.filter((e) => !e.sex && e.status !== "FIRED").length;
  const omittedNames = employees.filter(
    (e) =>
      e.status !== "FIRED" &&
      (isOmittedOrPlaceholderName(e.firstName) ||
        isOmittedOrPlaceholderName(e.lastName))
  );

  // Department health
  const deptMap = new Map<
    string,
    {
      headcount: number;
      active: number;
      absentDays: number;
      rateSum: number;
      rateCount: number;
      basic: bigint;
    }
  >();
  for (const e of employees) {
    if (e.status === "FIRED") continue;
    const key = e.department || "Unassigned";
    const row = deptMap.get(key) ?? {
      headcount: 0,
      active: 0,
      absentDays: 0,
      rateSum: 0,
      rateCount: 0,
      basic: 0n,
    };
    row.headcount += 1;
    if (e.status === "ACTIVE") row.active += 1;
    row.basic += e.basicSalaryKobo;
    const att = attByEmp.get(e.id);
    if (att && att.scheduled > 0) {
      row.absentDays += att.absent;
      const worked = att.present + att.late + att.partial;
      row.rateSum += Math.round((worked / att.scheduled) * 100);
      row.rateCount += 1;
    }
    deptMap.set(key, row);
  }

  const departmentHealth: DepartmentHealth[] = Array.from(deptMap.entries())
    .map(([department, d]) => ({
      department,
      headcount: d.headcount,
      active: d.active,
      absentDays: d.absentDays,
      avgAttendanceRate:
        d.rateCount > 0 ? Math.round(d.rateSum / d.rateCount) : null,
      payrollBasicKobo: d.basic.toString(),
    }))
    .sort((a, b) => b.absentDays - a.absentDays || b.headcount - a.headcount);

  // Insights
  if (pendingLeaveRows.length > 0) {
    insights.push({
      id: "pending-leave",
      severity: "watch",
      title: `${pendingLeaveRows.length} leave request${pendingLeaveRows.length === 1 ? "" : "s"} waiting`,
      detail:
        "Review and approve or reject so attendance and payroll stay accurate.",
      href: "/leave",
      metric: String(pendingLeaveRows.length),
    });
  }

  if (hrDeskOpen > 0) {
    insights.push({
      id: "hr-desk",
      severity: "watch",
      title: `${hrDeskOpen} HR Desk mail${hrDeskOpen === 1 ? "" : "s"} to triage`,
      detail: "Assign to staff and respond so requests do not stall.",
      href: "/hr-desk",
      metric: String(hrDeskOpen),
    });
  }

  if (totalAbsent > 0) {
    insights.push({
      id: "absences",
      severity: totalAbsent >= 10 ? "critical" : "watch",
      title: `${totalAbsent} missed shift${totalAbsent === 1 ? "" : "s"} this month`,
      detail: `Estimated attendance penalties total ${formatCurrency(totalPenalty)}. Apply them on draft payroll if not yet deducted.`,
      href: "/employees?tab=attendance",
      metric: formatCurrency(totalPenalty),
    });
  } else if (staffWithAttendance > 0) {
    insights.push({
      id: "attendance-good",
      severity: "good",
      title: "No missed shifts compiled this month",
      detail: "Attendance looks clean for staff with clock data and shifts.",
      href: "/employees?tab=attendance",
    });
  }

  if (avgAttendance != null) {
    insights.push({
      id: "attendance-rate",
      severity: avgAttendance < 85 ? "critical" : avgAttendance < 95 ? "watch" : "good",
      title: `Average attendance rate ${avgAttendance}%`,
      detail:
        avgAttendance < 95
          ? "Follow up with high-absence staff on the watchlist below."
          : "Workforce attendance is within a healthy range.",
      href: "/employees?tab=attendance",
      metric: `${avgAttendance}%`,
    });
  }

  if (missingClock > 0 || missingShift > 0) {
    insights.push({
      id: "setup-gaps",
      severity: "info",
      title: "Attendance setup incomplete",
      detail: `${missingClock} active staff missing clock machine ID · ${missingShift} missing shift assignment. Fix on employee edit so imports can analyse them.`,
      href: "/employees",
      metric: String(missingClock + missingShift),
    });
  }

  if (omittedNames.length > 0) {
    insights.push({
      id: "omitted-names",
      severity: "critical",
      title: `${omittedNames.length} staff record${omittedNames.length === 1 ? "" : "s"} with omitted or placeholder names`,
      detail: omittedNames
        .slice(0, 4)
        .map(
          (e) =>
            `${e.employeeCode}: ${displayName(e.firstName, e.lastName, "—")}`
        )
        .join(" · ") +
        (omittedNames.length > 4 ? ` +${omittedNames.length - 4} more` : "") +
        ". Fix before payroll submit — blocked in pre-flight.",
      href: "/employees",
      metric: String(omittedNames.length),
    });
  }

  if (missingSex > 0) {
    insights.push({
      id: "data-quality",
      severity: "info",
      title: `${missingSex} staff record${missingSex === 1 ? "" : "s"} missing sex`,
      detail: "Complete the staff table so reports and exports stay complete.",
      href: "/employees",
    });
  }

  const contractCount = employees.filter(
    (e) => e.employmentType === "CONTRACT" && e.status === "ACTIVE"
  ).length;
  if (active.length > 0 && contractCount / active.length >= 0.4) {
    insights.push({
      id: "contract-mix",
      severity: "info",
      title: `${Math.round((contractCount / active.length) * 100)}% of active staff are contract`,
      detail: "Review renewal dates and payroll treatment for contractors.",
      href: "/employees",
      metric: String(contractCount),
    });
  }

  if (latestPayroll) {
    const gross = latestPayroll.payslips.reduce(
      (s, p) => s + p.grossPayKobo,
      0n
    );
    const net = latestPayroll.payslips.reduce((s, p) => s + p.netPayKobo, 0n);
    insights.push({
      id: "latest-payroll",
      severity: "info",
      title: `Latest payroll ${getMonthName(latestPayroll.periodMonth)} ${latestPayroll.periodYear}`,
      detail: `Gross ${formatCurrency(gross)} · Net ${formatCurrency(net)} across ${latestPayroll.payslips.length} payslips.`,
      href: `/payroll/${latestPayroll.id}`,
      metric: formatCurrency(net),
    });
  } else {
    insights.push({
      id: "no-payroll",
      severity: "info",
      title: "No approved payroll yet",
      detail: "Run and approve a payroll period to unlock cost and remittance intelligence.",
      href: "/payroll",
    });
  }

  const topAbsenteeDept = departmentHealth.find((d) => d.absentDays > 0);
  if (topAbsenteeDept) {
    insights.push({
      id: "dept-absences",
      severity: "watch",
      title: `${topAbsenteeDept.department} leads missed shifts`,
      detail: `${topAbsenteeDept.absentDays} absent day(s) this month across ${topAbsenteeDept.headcount} staff.`,
      href: "/employees?tab=attendance",
    });
  }

  // —— Phase 2 risk signals (burnout / attrition / leave spike) ——
  function buildDeptStats(
    days: Array<{ employeeId: string; status: string }>
  ): DeptMonthStats[] {
    const byDept = new Map<string, DeptMonthStats>();
    const empDept = new Map(
      employees.map((e) => [e.id, e.department || "Unassigned"])
    );
    const headcounts = new Map<string, number>();
    for (const e of employees) {
      if (e.status === "FIRED") continue;
      const d = e.department || "Unassigned";
      headcounts.set(d, (headcounts.get(d) ?? 0) + 1);
    }
    for (const day of days) {
      const dept = empDept.get(day.employeeId) ?? "Unassigned";
      const row = byDept.get(dept) ?? {
        department: dept,
        headcount: headcounts.get(dept) ?? 0,
        absentDays: 0,
        lateDays: 0,
        scheduledDays: 0,
      };
      row.scheduledDays += 1;
      if (day.status === "ABSENT") row.absentDays += 1;
      if (day.status === "LATE" || day.status === "PARTIAL") row.lateDays += 1;
      byDept.set(dept, row);
    }
    // Ensure depts with headcount but no attendance still appear when current has data
    for (const [dept, hc] of headcounts) {
      if (!byDept.has(dept) && hc > 0) {
        byDept.set(dept, {
          department: dept,
          headcount: hc,
          absentDays: 0,
          lateDays: 0,
          scheduledDays: 0,
        });
      }
    }
    return Array.from(byDept.values());
  }

  const riskSignals: RiskSignal[] = [
    ...detectDepartmentPressure(
      buildDeptStats(attendanceDays),
      buildDeptStats(priorAttendanceDays)
    ),
    ...detectEarlyAttritionRisk(
      active.map((e) => {
        const att = attByEmp.get(e.id);
        return {
          employeeId: e.id,
          employeeCode: e.employeeCode,
          name: displayName(e.firstName, e.lastName, e.employeeCode),
          department: e.department,
          startDate: e.startDate,
          absentDays: att?.absent ?? 0,
          lateDays: (att?.late ?? 0) + (att?.partial ?? 0),
          scheduledDays: att?.scheduled ?? 0,
        };
      })
    ),
  ];

  const leaveSpike = detectLeaveSpike(
    leaveThisMonth.length,
    leavePriorMonth.length
  );
  if (leaveSpike) riskSignals.push(leaveSpike);

  insights.unshift(...riskSignalsToInsights(riskSignals));

  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    watch: 1,
    info: 2,
    good: 3,
  };
  insights.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  const riskBrief =
    riskSignals.length > 0
      ? `${riskSignals.length} risk signal(s): ${riskSignals
          .slice(0, 2)
          .map((r) => r.title)
          .join("; ")}${riskSignals.length > 2 ? "…" : ""}.`
      : "No elevated burnout or attrition risk signals this month.";

  const briefingLines = [
    `As of ${getMonthName(month)} ${year}, you have ${employees.length} staff records (${active.length} active) across ${departments.length || deptMap.size} departments.`,
    avgAttendance != null
      ? `Compiled attendance averages ${avgAttendance}% with ${totalAbsent} missed shift(s) and ${totalLate} late/partial day(s).`
      : "No attendance compiled yet — upload clock-machine data under Employees → Clock machine & attendance.",
    pendingLeaveRows.length || hrDeskOpen
      ? `Action queue: ${pendingLeaveRows.length} leave approval(s), ${hrDeskOpen} HR Desk item(s).`
      : "No leave or HR Desk items waiting.",
    watchlist.length
      ? `${watchlist.length} staff flagged for follow-up (absences, setup gaps, or status).`
      : "No staff currently on the intelligence watchlist.",
    riskBrief,
  ];

  const wageBillBasic = active.reduce((s, e) => s + e.basicSalaryKobo, 0n);
  const wageBillGrossish = active.reduce(
    (s, e) =>
      s +
      e.basicSalaryKobo +
      e.housingAllowanceKobo +
      e.transportAllowanceKobo,
    0n
  );

  return {
    period: { month, year, label: `${getMonthName(month)} ${year}` },
    briefing: briefingLines.join(" "),
    stats: {
      totalStaff: employees.length,
      activeStaff: active.length,
      onLeave: employees.filter((e) => e.status === "ON_LEAVE").length,
      sickLeave: employees.filter((e) => e.status === "SICK_LEAVE").length,
      suspended: employees.filter((e) => e.status === "SUSPENDED").length,
      contractStaff: contractCount,
      avgAttendanceRate: avgAttendance,
      missedShifts: totalAbsent,
      lateOrPartialDays: totalLate,
      attendancePenaltyKobo: totalPenalty.toString(),
      pendingLeave: pendingLeaveRows.length,
      hrDeskOpen,
      missingClockIds: missingClock,
      missingShifts: missingShift,
      monthlyBasicWageBillKobo: wageBillBasic.toString(),
      monthlyGrossishWageBillKobo: wageBillGrossish.toString(),
      approvedLeaveDaysThisMonth: leaveThisMonth
        .filter((l) => l.status === "APPROVED")
        .reduce((s, l) => s + l.days, 0),
      riskSignalCount: riskSignals.length,
    },
    insights: insights.slice(0, 12),
    riskSignals: riskSignals.slice(0, 8),
    watchlist: watchlist.slice(0, 15),
    departmentHealth: departmentHealth.slice(0, 12),
  };
}
