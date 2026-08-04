import { prisma } from "@/lib/db";
import { employeeStatusLabel, employeeSexLabel } from "@/lib/employees/status";

export type ChartSlice = { name: string; value: number; key: string };

export async function getOverviewData(companyId: string) {
  const [
    employees,
    payrollRuns,
    pendingLeave,
    pendingApprovals,
    latestPaidRun,
    unreadNotifications,
    departments,
    pendingHrDesk,
  ] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId },
      select: {
        status: true,
        sex: true,
        department: true,
        employmentType: true,
      },
    }),
    prisma.payrollRun.findMany({
      where: { companyId },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      take: 5,
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { payslips: true } },
      },
    }),
    prisma.leaveRequest.count({
      where: { status: "PENDING", employee: { companyId } },
    }),
    prisma.payrollRun.count({
      where: { companyId, status: "UNDER_REVIEW" },
    }),
    prisma.payrollRun.findFirst({
      where: { companyId, status: { in: ["APPROVED", "PAID"] } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: { payslips: true },
    }),
    prisma.notification.count({
      where: {
        companyId,
        readAt: null,
        type: { in: ["PAYROLL_REVIEW", "HR_DESK"] },
      },
    }),
    prisma.department.count({ where: { companyId } }),
    prisma.hrDeskMessage.count({
      where: {
        companyId,
        status: { in: ["NEW", "ASSIGNED", "TRIAGED"] },
      },
    }),
  ]);

  const totalStaff = employees.length;
  const byStatusMap = new Map<string, number>();
  const byDeptMap = new Map<string, number>();
  const bySexMap = new Map<string, number>();
  const byTypeMap = new Map<string, number>();

  for (const e of employees) {
    byStatusMap.set(e.status, (byStatusMap.get(e.status) ?? 0) + 1);
    const dept = e.department || "Unassigned";
    byDeptMap.set(dept, (byDeptMap.get(dept) ?? 0) + 1);
    const sex = e.sex ?? "UNSPECIFIED";
    bySexMap.set(sex, (bySexMap.get(sex) ?? 0) + 1);
    byTypeMap.set(
      e.employmentType,
      (byTypeMap.get(e.employmentType) ?? 0) + 1
    );
  }

  const activeCount = byStatusMap.get("ACTIVE") ?? 0;
  const draftRuns = payrollRuns.filter((r) => r.status === "DRAFT").length;

  const toSlices = (
    map: Map<string, number>,
    labelFn: (key: string) => string
  ): ChartSlice[] =>
    Array.from(map.entries())
      .map(([key, value]) => ({ key, name: labelFn(key), value }))
      .sort((a, b) => b.value - a.value);

  const latestTotals = latestPaidRun?.payslips.reduce(
    (acc, p) => ({
      gross: acc.gross + p.grossPayKobo,
      net: acc.net + p.netPayKobo,
      paye: acc.paye + p.payeKobo,
      pension: acc.pension + p.pensionEmployeeKobo + p.pensionEmployerKobo,
      nhf: acc.nhf + p.nhfKobo,
    }),
    { gross: 0n, net: 0n, paye: 0n, pension: 0n, nhf: 0n }
  );

  return {
    kpis: {
      totalStaff,
      activeStaff: activeCount,
      departments,
      pendingLeave,
      pendingApprovals,
      draftRuns,
      unreadApprovals: unreadNotifications,
      pendingHrDesk,
    },
    charts: {
      byStatus: toSlices(byStatusMap, employeeStatusLabel),
      byDepartment: toSlices(byDeptMap, (k) => k),
      bySex: toSlices(bySexMap, (k) =>
        k === "UNSPECIFIED" ? "Not set" : employeeSexLabel(k)
      ),
      byEmploymentType: toSlices(byTypeMap, (k) =>
        k === "FULL_TIME" ? "Full time" : "Contract"
      ),
    },
    recentRuns: payrollRuns.map((r) => ({
      id: r.id,
      periodMonth: r.periodMonth,
      periodYear: r.periodYear,
      status: r.status,
      createdBy: r.createdBy.name,
      payslipCount: r._count.payslips,
    })),
    latestPaidRun: latestPaidRun
      ? {
          id: latestPaidRun.id,
          periodMonth: latestPaidRun.periodMonth,
          periodYear: latestPaidRun.periodYear,
          status: latestPaidRun.status,
          headcount: latestPaidRun.payslips.length,
          totals: latestTotals!,
        }
      : null,
  };
}
