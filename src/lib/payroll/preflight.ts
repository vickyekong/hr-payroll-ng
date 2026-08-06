import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import {
  displayName,
  findIdentityGaps,
} from "@/lib/employees/data-quality";

export type PreflightSeverity = "block" | "warn" | "info";

export interface PreflightException {
  id: string;
  severity: PreflightSeverity;
  code: string;
  title: string;
  detail: string;
  employeeId?: string;
  employeeCode?: string;
  href?: string;
  metric?: string;
}

export interface PreflightSummary {
  runId: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  payslipCount: number;
  canSubmit: boolean;
  blockers: number;
  warnings: number;
  infos: number;
  exceptions: PreflightException[];
  totals: {
    grossKobo: string;
    netKobo: string;
    payeKobo: string;
    pensionEmployeeKobo: string;
    nhfKobo: string;
    attendancePenaltyKobo: string;
    unpaidLeaveDeductionKobo: string;
  };
  vsPrior: {
    periodLabel: string | null;
    headcountDelta: number | null;
    netDeltaKobo: string | null;
  };
}

const NET_SPIKE_RATIO = 0.25; // 25% MoM change

function normalizeAccount(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function detectDuplicateBankAccounts(
  employees: Array<{
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    bankAccountNumber: string | null;
  }>
): PreflightException[] {
  const byAccount = new Map<string, typeof employees>();
  for (const emp of employees) {
    const key = normalizeAccount(emp.bankAccountNumber);
    if (!key) continue;
    const list = byAccount.get(key) ?? [];
    list.push(emp);
    byAccount.set(key, list);
  }

  const exceptions: PreflightException[] = [];
  for (const [account, group] of byAccount) {
    if (group.length < 2) continue;
    const names = group
      .map((e) => `${e.firstName} ${e.lastName} (${e.employeeCode})`)
      .join(", ");
    exceptions.push({
      id: `dup-bank-${account}`,
      severity: "block",
      code: "DUPLICATE_BANK",
      title: "Duplicate bank account",
      detail: `${group.length} employees share account ending …${account.slice(-4)}: ${names}`,
      employeeId: group[0].id,
      employeeCode: group[0].employeeCode,
      href: `/employees/${group[0].id}/edit`,
      metric: account.slice(-4),
    });
  }
  return exceptions;
}

export function detectIdentityDataGaps(
  employees: Array<{
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: string;
    jobTitle: string;
  }>
): PreflightException[] {
  return findIdentityGaps(employees).map((gap) => ({
    id: `${gap.code.toLowerCase()}-${gap.employeeId}`,
    severity: gap.severity,
    code: gap.code,
    title: gap.title,
    detail: gap.detail,
    employeeId: gap.employeeId,
    employeeCode: gap.employeeCode,
    href: `/employees/${gap.employeeId}/edit`,
  }));
}

export function detectMissingPaymentFields(
  employees: Array<{
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    bankName: string | null;
    bankAccountNumber: string | null;
    tin: string | null;
    rsaPin: string | null;
    nhfNumber: string | null;
  }>,
  payslipMeta: Map<
    string,
    { pensionEmployeeKobo: bigint; nhfKobo: bigint }
  >
): PreflightException[] {
  const exceptions: PreflightException[] = [];

  for (const emp of employees) {
    const name = displayName(emp.firstName, emp.lastName, emp.employeeCode);
    const href = `/employees/${emp.id}/edit`;
    const meta = payslipMeta.get(emp.id);

    if (!normalizeAccount(emp.bankAccountNumber) || !emp.bankName?.trim()) {
      exceptions.push({
        id: `missing-bank-${emp.id}`,
        severity: "block",
        code: "MISSING_BANK",
        title: "Missing bank details",
        detail: `${name} (${emp.employeeCode}) has no usable bank name/account for disbursement.`,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        href,
      });
    }

    if (!emp.tin?.trim()) {
      exceptions.push({
        id: `missing-tin-${emp.id}`,
        severity: "warn",
        code: "MISSING_TIN",
        title: "Missing TIN",
        detail: `${name} (${emp.employeeCode}) has no TIN — PAYE filing may be incomplete.`,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        href,
      });
    }

    if (
      meta &&
      meta.pensionEmployeeKobo > 0n &&
      !emp.rsaPin?.trim()
    ) {
      exceptions.push({
        id: `missing-rsa-${emp.id}`,
        severity: "warn",
        code: "MISSING_RSA",
        title: "Missing RSA PIN",
        detail: `${name} (${emp.employeeCode}) has pension deducted but no RSA PIN.`,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        href,
        metric: formatCurrency(meta.pensionEmployeeKobo),
      });
    }

    if (meta && meta.nhfKobo > 0n && !emp.nhfNumber?.trim()) {
      exceptions.push({
        id: `missing-nhf-${emp.id}`,
        severity: "warn",
        code: "MISSING_NHF",
        title: "Missing NHF number",
        detail: `${name} (${emp.employeeCode}) has NHF deducted but no NHF membership number.`,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        href,
        metric: formatCurrency(meta.nhfKobo),
      });
    }
  }

  return exceptions;
}

export function detectNetPayVariances(
  current: Array<{
    employeeId: string;
    employeeCode: string;
    name: string;
    netPayKobo: bigint;
  }>,
  priorByEmployee: Map<string, bigint>,
  thresholdRatio = NET_SPIKE_RATIO
): PreflightException[] {
  const exceptions: PreflightException[] = [];

  for (const row of current) {
    const prior = priorByEmployee.get(row.employeeId);
    if (prior == null || prior === 0n) continue;

    const curr = row.netPayKobo;
    const delta = curr > prior ? curr - prior : prior - curr;
    const ratio = Number(delta) / Number(prior);
    if (ratio < thresholdRatio) continue;

    const up = curr > prior;
    const pct = Math.round(ratio * 100);
    exceptions.push({
      id: `net-spike-${row.employeeId}`,
      severity: "warn",
      code: "NET_PAY_VARIANCE",
      title: up ? "Unusual net pay increase" : "Unusual net pay decrease",
      detail: `${row.name} (${row.employeeCode}) net is ${pct}% ${up ? "higher" : "lower"} than the last paid run (${formatCurrency(prior)} → ${formatCurrency(curr)}).`,
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      href: `/employees/${row.employeeId}`,
      metric: `${up ? "+" : "-"}${pct}%`,
    });
  }

  return exceptions;
}

export function detectZeroOrNegativeNet(
  payslips: Array<{
    employeeId: string;
    employeeCode: string;
    name: string;
    netPayKobo: bigint;
  }>
): PreflightException[] {
  return payslips
    .filter((p) => p.netPayKobo <= 0n)
    .map((p) => ({
      id: `zero-net-${p.employeeId}`,
      severity: "warn" as const,
      code: "ZERO_NET",
      title: p.netPayKobo < 0n ? "Negative net pay" : "Zero net pay",
      detail: `${p.name} (${p.employeeCode}) has net ${formatCurrency(p.netPayKobo)}. Check deductions.`,
      employeeId: p.employeeId,
      employeeCode: p.employeeCode,
      href: `/employees/${p.employeeId}`,
      metric: formatCurrency(p.netPayKobo),
    }));
}

function severityRank(s: PreflightSeverity): number {
  if (s === "block") return 0;
  if (s === "warn") return 1;
  return 2;
}

export async function getPayrollPreflight(
  companyId: string,
  runId: string
): Promise<PreflightSummary> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId },
    include: {
      payslips: {
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: true,
              jobTitle: true,
              bankName: true,
              bankAccountNumber: true,
              tin: true,
              rsaPin: true,
              nhfNumber: true,
            },
          },
        },
      },
      adjustments: {
        select: { type: true, amountKobo: true },
      },
    },
  });

  if (!run) {
    throw new Error("Payroll run not found");
  }

  const prior = await prisma.payrollRun.findFirst({
    where: {
      companyId,
      status: { in: ["APPROVED", "PAID"] },
      OR: [
        { periodYear: { lt: run.periodYear } },
        {
          periodYear: run.periodYear,
          periodMonth: { lt: run.periodMonth },
        },
      ],
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    include: {
      payslips: {
        select: { employeeId: true, netPayKobo: true },
      },
    },
  });

  const employees = run.payslips.map((p) => p.employee);
  const payslipMeta = new Map(
    run.payslips.map((p) => [
      p.employeeId,
      {
        pensionEmployeeKobo: p.pensionEmployeeKobo,
        nhfKobo: p.nhfKobo,
      },
    ])
  );

  const currentNet = run.payslips.map((p) => ({
    employeeId: p.employeeId,
    employeeCode: p.employee.employeeCode,
    name: displayName(
      p.employee.firstName,
      p.employee.lastName,
      p.employee.employeeCode
    ),
    netPayKobo: p.netPayKobo,
  }));

  const priorByEmployee = new Map(
    (prior?.payslips ?? []).map((p) => [p.employeeId, p.netPayKobo])
  );

  const exceptions: PreflightException[] = [
    ...detectIdentityDataGaps(
      employees.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        firstName: e.firstName,
        lastName: e.lastName,
        department: e.department,
        jobTitle: e.jobTitle,
      }))
    ),
    ...detectDuplicateBankAccounts(employees),
    ...detectMissingPaymentFields(employees, payslipMeta),
    ...detectNetPayVariances(currentNet, priorByEmployee),
    ...detectZeroOrNegativeNet(currentNet),
  ];

  if (run.payslips.length === 0) {
    exceptions.push({
      id: "empty-run",
      severity: "block",
      code: "EMPTY_RUN",
      title: "Empty payroll run",
      detail: "No payslips generated. Recalculate before submitting.",
    });
  }

  let attendancePenaltyKobo = 0n;
  let unpaidLeaveDeductionKobo = 0n;
  for (const adj of run.adjustments) {
    if (adj.type === "ATTENDANCE_PENALTY") {
      attendancePenaltyKobo +=
        adj.amountKobo < 0n ? -adj.amountKobo : adj.amountKobo;
    }
    if (adj.type === "UNPAID_LEAVE") {
      unpaidLeaveDeductionKobo +=
        adj.amountKobo < 0n ? -adj.amountKobo : adj.amountKobo;
    }
  }

  if (attendancePenaltyKobo > 0n) {
    const count = run.adjustments.filter(
      (a) => a.type === "ATTENDANCE_PENALTY"
    ).length;
    exceptions.push({
      id: "attendance-penalties",
      severity: "info",
      code: "ATTENDANCE_PENALTIES",
      title: "Attendance penalties applied",
      detail: `${count} employee${count === 1 ? "" : "s"} have missed-shift penalties totaling ${formatCurrency(attendancePenaltyKobo)}.`,
      metric: formatCurrency(attendancePenaltyKobo),
      href: "/employees?tab=attendance",
    });
  }

  if (unpaidLeaveDeductionKobo > 0n) {
    exceptions.push({
      id: "unpaid-leave",
      severity: "info",
      code: "UNPAID_LEAVE",
      title: "Unpaid leave deductions",
      detail: `Approved unpaid leave deducted ${formatCurrency(unpaidLeaveDeductionKobo)} this period.`,
      metric: formatCurrency(unpaidLeaveDeductionKobo),
      href: "/leave",
    });
  }

  const priorCount = prior?.payslips.length ?? null;
  const headcountDelta =
    priorCount == null ? null : run.payslips.length - priorCount;

  if (headcountDelta != null && headcountDelta !== 0) {
    exceptions.push({
      id: "headcount-delta",
      severity: "info",
      code: "HEADCOUNT_CHANGE",
      title: "Headcount changed vs last paid run",
      detail: `${headcountDelta > 0 ? "+" : ""}${headcountDelta} vs prior period (${priorCount} → ${run.payslips.length}).`,
      metric: `${headcountDelta > 0 ? "+" : ""}${headcountDelta}`,
    });
  }

  // New joiners with no prior payslip
  if (prior) {
    const priorIds = new Set(prior.payslips.map((p) => p.employeeId));
    const newcomers = run.payslips.filter((p) => !priorIds.has(p.employeeId));
    if (newcomers.length > 0) {
      exceptions.push({
        id: "newcomers",
        severity: "info",
        code: "NEW_PAYEES",
        title: "New payees this period",
        detail: newcomers
          .slice(0, 5)
          .map(
            (p) =>
              `${p.employee.firstName} ${p.employee.lastName} (${p.employee.employeeCode})`
          )
          .join(", ") +
          (newcomers.length > 5 ? ` +${newcomers.length - 5} more` : ""),
        metric: String(newcomers.length),
      });
    }
  }

  exceptions.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.title.localeCompare(b.title)
  );

  const blockers = exceptions.filter((e) => e.severity === "block").length;
  const warnings = exceptions.filter((e) => e.severity === "warn").length;
  const infos = exceptions.filter((e) => e.severity === "info").length;

  let gross = 0n;
  let net = 0n;
  let paye = 0n;
  let pensionEe = 0n;
  let nhf = 0n;
  for (const p of run.payslips) {
    gross += p.grossPayKobo;
    net += p.netPayKobo;
    paye += p.payeKobo;
    pensionEe += p.pensionEmployeeKobo;
    nhf += p.nhfKobo;
  }

  let priorNet = 0n;
  for (const p of prior?.payslips ?? []) priorNet += p.netPayKobo;
  const netDelta =
    prior && prior.payslips.length > 0 ? (net - priorNet).toString() : null;

  return {
    runId: run.id,
    periodMonth: run.periodMonth,
    periodYear: run.periodYear,
    status: run.status,
    payslipCount: run.payslips.length,
    canSubmit: blockers === 0 && run.payslips.length > 0,
    blockers,
    warnings,
    infos,
    exceptions,
    totals: {
      grossKobo: gross.toString(),
      netKobo: net.toString(),
      payeKobo: paye.toString(),
      pensionEmployeeKobo: pensionEe.toString(),
      nhfKobo: nhf.toString(),
      attendancePenaltyKobo: attendancePenaltyKobo.toString(),
      unpaidLeaveDeductionKobo: unpaidLeaveDeductionKobo.toString(),
    },
    vsPrior: {
      periodLabel: prior
        ? `${prior.periodMonth}/${prior.periodYear}`
        : null,
      headcountDelta,
      netDeltaKobo: netDelta,
    },
  };
}
