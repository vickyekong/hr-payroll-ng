import { prisma } from "@/lib/db";
import { buildCsv, formatNairaFromKobo } from "@/lib/reports/csv";

export async function buildPayrollExportCsv(
  companyId: string,
  runId: string
): Promise<{
  csv: string;
  filename: string;
  rowCount: number;
  periodLabel: string;
}> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId },
    include: {
      payslips: {
        include: {
          employee: {
            select: {
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: true,
              jobTitle: true,
              bankName: true,
              bankAccountNumber: true,
            },
          },
        },
        orderBy: { employee: { employeeCode: "asc" } },
      },
    },
  });

  if (!run) {
    throw new Error("Payroll run not found");
  }

  const headers = [
    "Period Month",
    "Period Year",
    "Run Status",
    "Employee Code",
    "First Name",
    "Last Name",
    "Department",
    "Job Title",
    "Bank Name",
    "Bank Account",
    "Basic (NGN)",
    "Housing (NGN)",
    "Transport (NGN)",
    "Other Allowances (NGN)",
    "Bonuses (NGN)",
    "Gross Pay (NGN)",
    "PAYE (NGN)",
    "Pension Employee (NGN)",
    "Pension Employer (NGN)",
    "NHF (NGN)",
    "NSITF (NGN)",
    "Other Deductions (NGN)",
    "Net Pay (NGN)",
  ];

  const rows = run.payslips.map((p) => [
    run.periodMonth,
    run.periodYear,
    run.status,
    p.employee.employeeCode,
    p.employee.firstName,
    p.employee.lastName,
    p.employee.department,
    p.employee.jobTitle,
    p.employee.bankName ?? "",
    p.employee.bankAccountNumber ?? "",
    formatNairaFromKobo(p.basicSalaryKobo),
    formatNairaFromKobo(p.housingAllowanceKobo),
    formatNairaFromKobo(p.transportAllowanceKobo),
    formatNairaFromKobo(p.otherAllowancesKobo),
    formatNairaFromKobo(p.bonusesKobo),
    formatNairaFromKobo(p.grossPayKobo),
    formatNairaFromKobo(p.payeKobo),
    formatNairaFromKobo(p.pensionEmployeeKobo),
    formatNairaFromKobo(p.pensionEmployerKobo),
    formatNairaFromKobo(p.nhfKobo),
    formatNairaFromKobo(p.nsitfKobo),
    formatNairaFromKobo(p.otherDeductionsKobo),
    formatNairaFromKobo(p.netPayKobo),
  ]);

  const periodLabel = `${String(run.periodMonth).padStart(2, "0")}-${run.periodYear}`;
  return {
    csv: buildCsv(headers, rows),
    filename: `payroll-export-${periodLabel}-${run.status.toLowerCase()}.csv`,
    rowCount: run.payslips.length,
    periodLabel,
  };
}
