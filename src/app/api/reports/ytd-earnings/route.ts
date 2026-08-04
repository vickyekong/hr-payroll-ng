import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  buildCsv,
  csvResponse,
  formatNairaFromKobo,
} from "@/lib/reports/csv";

export async function GET(req: Request) {
  try {
    const session = await requirePermission("viewReports");
    const { searchParams } = new URL(req.url);
    const year = parseInt(
      searchParams.get("year") ?? String(new Date().getFullYear())
    );
    const format = searchParams.get("format") ?? "json";

    const payslips = await prisma.payslip.findMany({
      where: {
        payrollRun: {
          companyId: session.user.companyId,
          periodYear: year,
          status: { in: ["APPROVED", "PAID"] },
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: true,
            tin: true,
          },
        },
        payrollRun: {
          select: { periodMonth: true, periodYear: true },
        },
      },
    });

    type EmployeeYtd = {
      employeeId: string;
      employeeCode: string;
      name: string;
      department: string;
      tin: string | null;
      ytdGrossKobo: bigint;
      ytdPayeKobo: bigint;
      ytdPensionEmployeeKobo: bigint;
      ytdNetKobo: bigint;
      monthsPaid: number;
    };

    const byEmployee = new Map<string, EmployeeYtd>();

    for (const slip of payslips) {
      const key = slip.employeeId;
      const existing = byEmployee.get(key) ?? {
        employeeId: slip.employeeId,
        employeeCode: slip.employee.employeeCode,
        name: `${slip.employee.firstName} ${slip.employee.lastName}`,
        department: slip.employee.department,
        tin: slip.employee.tin,
        ytdGrossKobo: 0n,
        ytdPayeKobo: 0n,
        ytdPensionEmployeeKobo: 0n,
        ytdNetKobo: 0n,
        monthsPaid: 0,
      };

      existing.ytdGrossKobo += slip.grossPayKobo;
      existing.ytdPayeKobo += slip.payeKobo;
      existing.ytdPensionEmployeeKobo += slip.pensionEmployeeKobo;
      existing.ytdNetKobo += slip.netPayKobo;
      existing.monthsPaid += 1;
      byEmployee.set(key, existing);
    }

    const rows = Array.from(byEmployee.values()).sort((a, b) =>
      a.employeeCode.localeCompare(b.employeeCode)
    );

    if (format === "csv") {
      const csv = buildCsv(
        [
          "Employee ID",
          "Name",
          "Department",
          "TIN",
          "Months Paid",
          "YTD Gross (NGN)",
          "YTD PAYE (NGN)",
          "YTD Pension Employee (NGN)",
          "YTD Net (NGN)",
        ],
        rows.map((r) => [
          r.employeeCode,
          r.name,
          r.department,
          r.tin ?? "",
          r.monthsPaid,
          formatNairaFromKobo(r.ytdGrossKobo),
          formatNairaFromKobo(r.ytdPayeKobo),
          formatNairaFromKobo(r.ytdPensionEmployeeKobo),
          formatNairaFromKobo(r.ytdNetKobo),
        ])
      );
      return csvResponse(csv, `ytd-earnings-${year}.csv`);
    }

    return NextResponse.json({
      year,
      employeeCount: rows.length,
      employees: rows.map((r) => ({
        ...r,
        ytdGrossKobo: r.ytdGrossKobo.toString(),
        ytdPayeKobo: r.ytdPayeKobo.toString(),
        ytdPensionEmployeeKobo: r.ytdPensionEmployeeKobo.toString(),
        ytdNetKobo: r.ytdNetKobo.toString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
