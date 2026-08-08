import type { Employee, PayrollRun } from "@prisma/client";
import { startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import {
  calculatePayroll,
  calculateUnpaidLeaveDeduction,
  getDailyRateFromMonthly,
} from "@/lib/payroll/calculate-payroll";
import {
  aggregateAdjustments,
  mergeAdjustments,
} from "@/lib/payroll/adjustments";
import {
  mapStatutoryConfig,
  reviveStatutorySnapshot,
  serializeBigInts,
} from "@/lib/payroll/config-mapper";
import {
  sumUnpaidLeaveDaysInPeriod,
  type LeaveRequestDates,
} from "@/lib/leave/unpaid-leave";
import type { PayrollAdjustments, StatutoryConfigInput } from "@/lib/payroll/types";
import { ensurePayrollHardeningSchema } from "@/lib/ensure-payroll-hardening-schema";

export class PayrollRunError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function loadRunContext(
  runId: string,
  companyId: string,
  options?: { preferSnapshot?: boolean }
) {
  await ensurePayrollHardeningSchema();

  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId },
    include: {
      adjustments: true,
    },
  });

  if (!run) {
    throw new PayrollRunError("Payroll run not found", 404);
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { statutoryConfig: true, taxBands: true },
  });

  const liveConfig = mapStatutoryConfig(
    company?.statutoryConfig ?? null,
    company?.taxBands
  );

  const snap = options?.preferSnapshot
    ? reviveStatutorySnapshot(run.statutorySnapshot)
    : null;
  const config: StatutoryConfigInput = snap ?? liveConfig;

  return { run, config, liveConfig };
}

async function getUnpaidLeaveMap(
  companyId: string,
  periodMonth: number,
  periodYear: number
) {
  const periodStart = startOfMonth(new Date(periodYear, periodMonth - 1));
  const periodEnd = endOfMonth(periodStart);

  const unpaidRequests = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      type: "UNPAID",
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
      employee: { companyId },
    },
    select: {
      employeeId: true,
      startDate: true,
      endDate: true,
    },
  });

  const map = new Map<string, LeaveRequestDates[]>();
  for (const req of unpaidRequests) {
    const list = map.get(req.employeeId) ?? [];
    list.push({ startDate: req.startDate, endDate: req.endDate });
    map.set(req.employeeId, list);
  }

  const result = new Map<string, number>();
  for (const [employeeId, requests] of map) {
    result.set(
      employeeId,
      sumUnpaidLeaveDaysInPeriod(requests, periodStart, periodEnd)
    );
  }
  return result;
}

function adjustmentsByEmployee(
  run: PayrollRun & { adjustments: Array<{ employeeId: string; type: string; amountKobo: bigint }> }
) {
  const map = new Map<string, ReturnType<typeof aggregateAdjustments>>();

  const grouped = new Map<string, Array<{ type: string; amountKobo: bigint }>>();
  for (const adj of run.adjustments) {
    const list = grouped.get(adj.employeeId) ?? [];
    list.push({ type: adj.type, amountKobo: adj.amountKobo });
    grouped.set(adj.employeeId, list);
  }

  for (const [employeeId, records] of grouped) {
    map.set(employeeId, aggregateAdjustments(records));
  }

  return map;
}

function buildLeaveAdjustments(
  employee: Employee,
  unpaidDays: number,
  workingDaysPerMonth: number
): PayrollAdjustments {
  if (unpaidDays <= 0) return {};

  // Daily rate from taxable package only (exclude non-taxable reimbursements)
  const monthlyTaxable =
    employee.basicSalaryKobo +
    employee.housingAllowanceKobo +
    employee.transportAllowanceKobo +
    employee.otherTaxableAllowancesKobo;

  return {
    unpaidLeaveDeductionKobo: calculateUnpaidLeaveDeduction(
      getDailyRateFromMonthly(monthlyTaxable, workingDaysPerMonth),
      unpaidDays
    ),
  };
}

async function computeYtd(
  employeeId: string,
  companyId: string,
  periodYear: number,
  periodMonth: number,
  currentGross: bigint,
  currentPaye: bigint,
  currentNet: bigint
) {
  const ytdPayslips = await prisma.payslip.findMany({
    where: {
      employeeId,
      payrollRun: {
        companyId,
        periodYear,
        periodMonth: { lt: periodMonth },
        status: { in: ["APPROVED", "PAID"] },
      },
    },
  });

  return {
    ytdGrossKobo:
      ytdPayslips.reduce((sum, slip) => sum + slip.grossPayKobo, 0n) +
      currentGross,
    ytdPayeKobo:
      ytdPayslips.reduce((sum, slip) => sum + slip.payeKobo, 0n) + currentPaye,
    ytdNetKobo:
      ytdPayslips.reduce((sum, slip) => sum + slip.netPayKobo, 0n) + currentNet,
  };
}

function payslipDataFromBreakdown(
  runId: string,
  employeeId: string,
  breakdown: ReturnType<typeof calculatePayroll>,
  ytd: { ytdGrossKobo: bigint; ytdPayeKobo: bigint; ytdNetKobo: bigint }
) {
  return {
    payrollRunId: runId,
    employeeId,
    grossPayKobo: breakdown.earnings.grossPayKobo,
    basicSalaryKobo: breakdown.earnings.basicSalaryKobo,
    housingAllowanceKobo: breakdown.earnings.housingAllowanceKobo,
    transportAllowanceKobo: breakdown.earnings.transportAllowanceKobo,
    otherAllowancesKobo: breakdown.earnings.otherAllowancesKobo,
    bonusesKobo: breakdown.earnings.bonusesKobo,
    payeKobo: breakdown.deductions.payeKobo,
    pensionEmployeeKobo: breakdown.deductions.pensionEmployeeKobo,
    pensionEmployerKobo: breakdown.employerCosts.pensionEmployerKobo,
    nhfKobo: breakdown.deductions.nhfKobo,
    nsitfKobo: breakdown.employerCosts.nsitfKobo,
    otherDeductionsKobo:
      breakdown.deductions.loanDeductionKobo +
      breakdown.deductions.advanceDeductionKobo +
      breakdown.deductions.unpaidLeaveDeductionKobo +
      breakdown.deductions.otherDeductionsKobo,
    netPayKobo: breakdown.netPayKobo,
    ytdGrossKobo: ytd.ytdGrossKobo,
    ytdPayeKobo: ytd.ytdPayeKobo,
    ytdNetKobo: ytd.ytdNetKobo,
    breakdown: serializeBigInts(breakdown) as object,
  };
}

/** Generate or refresh all payslips for a draft payroll run. */
export async function recalculatePayrollRun(
  runId: string,
  companyId: string,
  options?: { employeeId?: string }
) {
  const { run, config } = await loadRunContext(runId, companyId);

  if (run.status !== "DRAFT") {
    throw new PayrollRunError(
      "Can only recalculate draft payroll runs",
      400
    );
  }

  const unpaidLeaveMap = await getUnpaidLeaveMap(
    companyId,
    run.periodMonth,
    run.periodYear
  );
  const manualAdjustments = adjustmentsByEmployee(run);

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      ...(options?.employeeId ? { id: options.employeeId } : {}),
    },
  });

  if (options?.employeeId && employees.length === 0) {
    throw new PayrollRunError("Employee not found or not active", 404);
  }

  const processedEmployeeIds: string[] = [];

  for (const employee of employees) {
    const leaveAdj = buildLeaveAdjustments(
      employee,
      unpaidLeaveMap.get(employee.id) ?? 0,
      config.workingDaysPerMonth
    );
    const manualAdj = manualAdjustments.get(employee.id) ?? {};
    const adjustments = mergeAdjustments(leaveAdj, manualAdj);

    const breakdown = calculatePayroll(
      {
        basicSalaryKobo: employee.basicSalaryKobo,
        housingAllowanceKobo: employee.housingAllowanceKobo,
        transportAllowanceKobo: employee.transportAllowanceKobo,
        otherTaxableAllowancesKobo: employee.otherTaxableAllowancesKobo,
        nonTaxableReimbursementsKobo: employee.nonTaxableReimbursementsKobo,
        annualRentKobo: employee.annualRentKobo,
      },
      config,
      { month: run.periodMonth, year: run.periodYear },
      adjustments
    );

    const ytd = await computeYtd(
      employee.id,
      companyId,
      run.periodYear,
      run.periodMonth,
      breakdown.earnings.grossPayKobo,
      breakdown.deductions.payeKobo,
      breakdown.netPayKobo
    );

    const payslipData = payslipDataFromBreakdown(
      run.id,
      employee.id,
      breakdown,
      ytd
    );

    await prisma.payslip.upsert({
      where: {
        payrollRunId_employeeId: {
          payrollRunId: run.id,
          employeeId: employee.id,
        },
      },
      create: payslipData,
      update: payslipData,
    });

    processedEmployeeIds.push(employee.id);
  }

  // Full run recalc: drop payslips for employees no longer active
  if (!options?.employeeId) {
    await prisma.payslip.deleteMany({
      where: {
        payrollRunId: run.id,
        employeeId: { notIn: processedEmployeeIds },
      },
    });
  }

  // Freeze the statutory rules used for this draft calculation
  await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      statutorySnapshot: serializeBigInts(config) as object,
    },
  });

  return { employeeCount: processedEmployeeIds.length };
}

/** Persist / refresh statutory snapshot (also called on approve). */
export async function snapshotStatutoryConfigForRun(
  runId: string,
  companyId: string
) {
  const { liveConfig } = await loadRunContext(runId, companyId);
  await prisma.payrollRun.update({
    where: { id: runId },
    data: {
      statutorySnapshot: serializeBigInts(liveConfig) as object,
    },
  });
  return liveConfig;
}

/** Reverse an approved/paid run back to draft and regenerate payslips. */
export async function reverseAndRegeneratePayrollRun(
  runId: string,
  companyId: string
) {
  await ensurePayrollHardeningSchema();

  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId },
  });

  if (!run) {
    throw new PayrollRunError("Payroll run not found", 404);
  }

  if (run.status !== "APPROVED" && run.status !== "PAID") {
    throw new PayrollRunError(
      "Can only reverse approved or paid payroll runs",
      400
    );
  }

  await prisma.payslip.deleteMany({ where: { payrollRunId: run.id } });

  await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: "DRAFT",
      approvedById: null,
      approvedAt: null,
      paidAt: null,
    },
  });

  // Prefer the frozen snapshot from the original approved calculation
  return recalculatePayrollRunWithConfigPreference(runId, companyId, true);
}

async function recalculatePayrollRunWithConfigPreference(
  runId: string,
  companyId: string,
  preferSnapshot: boolean
) {
  // Temporarily load with snapshot preference by patching via a one-off path:
  // recalculatePayrollRun always uses live; for reverse we rehydrate snapshot into liveConfig path.
  if (!preferSnapshot) {
    return recalculatePayrollRun(runId, companyId);
  }

  const { run, config } = await loadRunContext(runId, companyId, {
    preferSnapshot: true,
  });

  if (run.status !== "DRAFT") {
    throw new PayrollRunError(
      "Can only recalculate draft payroll runs",
      400
    );
  }

  const unpaidLeaveMap = await getUnpaidLeaveMap(
    companyId,
    run.periodMonth,
    run.periodYear
  );
  const manualAdjustments = adjustmentsByEmployee(run);

  const employees = await prisma.employee.findMany({
    where: { companyId, status: "ACTIVE" },
  });

  const processedEmployeeIds: string[] = [];

  for (const employee of employees) {
    const leaveAdj = buildLeaveAdjustments(
      employee,
      unpaidLeaveMap.get(employee.id) ?? 0,
      config.workingDaysPerMonth
    );
    const manualAdj = manualAdjustments.get(employee.id) ?? {};
    const adjustments = mergeAdjustments(leaveAdj, manualAdj);

    const breakdown = calculatePayroll(
      {
        basicSalaryKobo: employee.basicSalaryKobo,
        housingAllowanceKobo: employee.housingAllowanceKobo,
        transportAllowanceKobo: employee.transportAllowanceKobo,
        otherTaxableAllowancesKobo: employee.otherTaxableAllowancesKobo,
        nonTaxableReimbursementsKobo: employee.nonTaxableReimbursementsKobo,
        annualRentKobo: employee.annualRentKobo,
      },
      config,
      { month: run.periodMonth, year: run.periodYear },
      adjustments
    );

    const ytd = await computeYtd(
      employee.id,
      companyId,
      run.periodYear,
      run.periodMonth,
      breakdown.earnings.grossPayKobo,
      breakdown.deductions.payeKobo,
      breakdown.netPayKobo
    );

    const payslipData = payslipDataFromBreakdown(
      run.id,
      employee.id,
      breakdown,
      ytd
    );

    await prisma.payslip.upsert({
      where: {
        payrollRunId_employeeId: {
          payrollRunId: run.id,
          employeeId: employee.id,
        },
      },
      create: payslipData,
      update: payslipData,
    });

    processedEmployeeIds.push(employee.id);
  }

  await prisma.payslip.deleteMany({
    where: {
      payrollRunId: run.id,
      employeeId: { notIn: processedEmployeeIds },
    },
  });

  await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      statutorySnapshot: serializeBigInts(config) as object,
    },
  });

  return { employeeCount: processedEmployeeIds.length };
}
