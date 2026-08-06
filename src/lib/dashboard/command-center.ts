import { prisma } from "@/lib/db";
import { getOverviewData } from "@/lib/dashboard/overview";
import { getStaffIntelligence } from "@/lib/intelligence/staff-insights";
import { getMonthName } from "@/lib/utils";

export type ActionItem = {
  id: string;
  label: string;
  count: number;
  href: string;
};

export type CoPilotLine = {
  id: string;
  text: string;
  href?: string;
};

export async function getCommandCenterData(companyId: string) {
  const now = new Date();
  const periodMonth = now.getMonth() + 1;
  const periodYear = now.getFullYear();

  // Load heavy trees sequentially so serverless Prisma (often
  // connection_limit=1) is not starved by nested Promise.all fans.
  const overview = await getOverviewData(companyId);
  const intelligence = await getStaffIntelligence(companyId);

  const [
    pendingChanges,
    openOnboarding,
    openOffboarding,
    paidRuns,
    missingTin,
    missingRsa,
  ] = await Promise.all([
    prisma.employeeChangeRequest.count({
      where: { companyId, status: "PENDING" },
    }),
    prisma.employeeLifecycle.count({
      where: { companyId, kind: "ONBOARDING", status: "OPEN" },
    }),
    prisma.employeeLifecycle.count({
      where: { companyId, kind: "OFFBOARDING", status: "OPEN" },
    }),
    prisma.payrollRun.findMany({
      where: { companyId, status: { in: ["APPROVED", "PAID"] } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      take: 2,
      include: {
        payslips: {
          select: {
            netPayKobo: true,
            grossPayKobo: true,
          },
        },
      },
    }),
    prisma.employee.count({
      where: {
        companyId,
        status: { in: ["ACTIVE", "ON_LEAVE", "SICK_LEAVE"] },
        OR: [{ tin: null }, { tin: "" }],
      },
    }),
    prisma.employee.count({
      where: {
        companyId,
        status: { in: ["ACTIVE", "ON_LEAVE", "SICK_LEAVE"] },
        OR: [{ rsaPin: null }, { rsaPin: "" }],
      },
    }),
  ]);

  const priorPaid = paidRuns[1] ?? null;

  const actions: ActionItem[] = [];
  if (pendingChanges > 0) {
    actions.push({
      id: "changes",
      label: "Bank / data updates awaiting approval",
      count: pendingChanges,
      href: "/hr-ask?tab=changes",
    });
  }
  if (overview.kpis.pendingApprovals > 0) {
    actions.push({
      id: "payroll-review",
      label: "Payroll awaiting Super Admin approval",
      count: overview.kpis.pendingApprovals,
      href: "/payroll",
    });
  }
  if (overview.kpis.pendingLeave > 0) {
    actions.push({
      id: "leave",
      label: "Leave to record or approve",
      count: overview.kpis.pendingLeave,
      href: "/leave",
    });
  }
  if (openOnboarding > 0) {
    actions.push({
      id: "onboarding",
      label: "Onboarding checklists open",
      count: openOnboarding,
      href: "/employees",
    });
  }
  if (openOffboarding > 0) {
    actions.push({
      id: "offboarding",
      label: "Offboarding checklists open",
      count: openOffboarding,
      href: "/employees",
    });
  }
  if (overview.kpis.pendingHrDesk > 0) {
    actions.push({
      id: "desk",
      label: "HR Desk mail to triage",
      count: overview.kpis.pendingHrDesk,
      href: "/hr-desk",
    });
  }
  if (overview.kpis.draftRuns > 0) {
    actions.push({
      id: "draft",
      label: "Draft payroll runs in progress",
      count: overview.kpis.draftRuns,
      href: "/payroll",
    });
  }

  const latest = overview.latestPaidRun;
  let runRateDeltaPct: number | null = null;
  if (latest && priorPaid && priorPaid.payslips.length > 0) {
    const priorNet = priorPaid.payslips.reduce((s, p) => s + p.netPayKobo, 0n);
    if (priorNet > 0n) {
      const delta = Number(latest.totals.net - priorNet) / Number(priorNet);
      runRateDeltaPct = Math.round(delta * 1000) / 10;
    }
  }

  const nextRunDay = 28;
  const nextRunLabel = `${getMonthName(periodMonth)} ${nextRunDay}`;

  const complianceIssues = missingTin + missingRsa;
  const taxCompliant = missingTin === 0;

  const coPilot: CoPilotLine[] = [];
  for (const insight of intelligence.insights.slice(0, 4)) {
    coPilot.push({
      id: insight.id,
      text: insight.detail || insight.title,
      href: insight.href,
    });
  }
  for (const risk of (intelligence.riskSignals ?? []).slice(0, 2)) {
    coPilot.push({
      id: `risk-${risk.id}`,
      text: risk.detail || risk.title,
      href: risk.href,
    });
  }
  if (coPilot.length === 0 && intelligence.briefing) {
    coPilot.push({ id: "briefing", text: intelligence.briefing });
  }

  return {
    userFacingPeriod: {
      month: periodMonth,
      year: periodYear,
      label: getMonthName(periodMonth),
    },
    nextRunLabel,
    actions,
    actionCount: actions.reduce((s, a) => s + a.count, 0),
    runRate: latest
      ? {
          netKobo: latest.totals.net.toString(),
          grossKobo: latest.totals.gross.toString(),
          periodLabel: `${getMonthName(latest.periodMonth)} ${latest.periodYear}`,
          runId: latest.id,
          deltaPct: runRateDeltaPct,
          headcount: latest.headcount,
        }
      : null,
    compliance: {
      taxCompliant,
      missingTin,
      missingRsa,
      pensionsDue: missingRsa,
      issueCount: complianceIssues,
    },
    coPilot,
    overview,
    intelligence,
  };
}
