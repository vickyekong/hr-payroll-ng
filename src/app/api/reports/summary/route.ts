import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";

export async function GET(req: Request) {
  try {
    const session = await requirePermission("viewReports");
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

    const run = await prisma.payrollRun.findFirst({
      where: {
        companyId: session.user.companyId,
        periodMonth: month,
        periodYear: year,
        status: { in: ["APPROVED", "PAID"] },
      },
      include: {
        payslips: {
          include: {
            employee: { select: { department: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({
        period: { month, year },
        hasData: false,
        summary: null,
        byDepartment: [],
        remittances: null,
      });
    }

    const payslips = run.payslips;
    const summary = payslips.reduce(
      (acc, p) => ({
        totalGross: acc.totalGross + p.grossPayKobo,
        totalNet: acc.totalNet + p.netPayKobo,
        totalPaye: acc.totalPaye + p.payeKobo,
        totalPensionEmployee: acc.totalPensionEmployee + p.pensionEmployeeKobo,
        totalPensionEmployer: acc.totalPensionEmployer + p.pensionEmployerKobo,
        totalNhf: acc.totalNhf + p.nhfKobo,
        totalNsitf: acc.totalNsitf + p.nsitfKobo,
        totalEmployerCost:
          acc.totalEmployerCost +
          p.grossPayKobo +
          p.pensionEmployerKobo +
          p.nsitfKobo,
        headcount: acc.headcount + 1,
      }),
      {
        totalGross: 0n,
        totalNet: 0n,
        totalPaye: 0n,
        totalPensionEmployee: 0n,
        totalPensionEmployer: 0n,
        totalNhf: 0n,
        totalNsitf: 0n,
        totalEmployerCost: 0n,
        headcount: 0,
      }
    );

    const deptMap = new Map<string, { gross: bigint; count: number }>();
    for (const p of payslips) {
      const dept = p.employee.department;
      const existing = deptMap.get(dept) ?? { gross: 0n, count: 0 };
      deptMap.set(dept, {
        gross: existing.gross + p.grossPayKobo,
        count: existing.count + 1,
      });
    }

    const byDepartment = Array.from(deptMap.entries()).map(([department, data]) => ({
      department,
      gross: data.gross.toString(),
      count: data.count,
    }));

    return NextResponse.json({
      period: { month, year },
      hasData: true,
      summary: {
        ...Object.fromEntries(
          Object.entries(summary).map(([k, v]) => [
            k,
            typeof v === "bigint" ? v.toString() : v,
          ])
        ),
      },
      byDepartment,
      remittances: {
        paye: summary.totalPaye.toString(),
        pensionEmployee: summary.totalPensionEmployee.toString(),
        pensionEmployer: summary.totalPensionEmployer.toString(),
        nhf: summary.totalNhf.toString(),
        nsitf: summary.totalNsitf.toString(),
        deadlines: {
          paye: "10th of following month (State IRS)",
          pension: "7 working days after salary payment",
          nhf: "Within 30 days of deduction",
          nsitf: "Within 30 days of contribution",
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
