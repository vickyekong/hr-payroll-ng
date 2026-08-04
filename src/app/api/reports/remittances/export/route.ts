import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { getMonthName } from "@/lib/utils";
import {
  buildCsv,
  csvResponse,
  formatNairaFromKobo,
} from "@/lib/reports/csv";
import {
  buildRemittanceSchedule,
  getApprovedPayrollRun,
  sumRemittances,
} from "@/lib/reports/remittances";

export async function GET(req: Request) {
  try {
    const session = await requirePermission("viewReports");
    const { searchParams } = new URL(req.url);
    const month = parseInt(
      searchParams.get("month") ?? String(new Date().getMonth() + 1)
    );
    const year = parseInt(
      searchParams.get("year") ?? String(new Date().getFullYear())
    );

    const run = await getApprovedPayrollRun(
      session.user.companyId,
      month,
      year
    );

    if (!run) {
      return NextResponse.json(
        { error: "No approved payroll run for this period" },
        { status: 404 }
      );
    }

    const periodLabel = `${getMonthName(month)} ${year}`;
    const totals = sumRemittances(run.payslips);
    const schedule = buildRemittanceSchedule(totals, periodLabel);

    const summaryCsv = buildCsv(
      ["Statutory Body", "Amount (NGN)", "Due Date", "Period", "Notes"],
      schedule.map((row) => [
        row.body,
        formatNairaFromKobo(row.amountKobo),
        row.dueDate,
        periodLabel,
        row.notes,
      ])
    );

    const pensionDetail = run.payslips
      .filter((p) => p.pensionEmployeeKobo > 0n || p.pensionEmployerKobo > 0n)
      .map((p) => [
        p.employee.employeeCode,
        `${p.employee.firstName} ${p.employee.lastName}`,
        p.employee.rsaPin ?? "",
        formatNairaFromKobo(p.pensionEmployeeKobo),
        formatNairaFromKobo(p.pensionEmployerKobo),
      ]);

    const detailCsv =
      pensionDetail.length > 0
        ? `\n\nPension detail by employee\n${buildCsv(
            [
              "Employee ID",
              "Name",
              "RSA PIN",
              "Employee (NGN)",
              "Employer (NGN)",
            ],
            pensionDetail
          )}`
        : "";

    const csv = `# ${run.company.name} — Remittance schedule\n# Generated for ${periodLabel}\n${summaryCsv}${detailCsv}`;

    const filename = `remittances-${year}-${String(month).padStart(2, "0")}.csv`;
    return csvResponse(csv, filename);
  } catch (error) {
    return handleApiError(error);
  }
}
