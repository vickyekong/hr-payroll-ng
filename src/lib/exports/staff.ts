import { prisma } from "@/lib/db";
import { buildCsv, formatNairaFromKobo } from "@/lib/reports/csv";

export async function buildStaffExportCsv(companyId: string): Promise<{
  csv: string;
  filename: string;
  rowCount: number;
}> {
  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: { employeeCode: "asc" },
  });

  const headers = [
    "Employee Code",
    "First Name",
    "Last Name",
    "Department",
    "Job Title",
    "Employment Type",
    "Status",
    "Start Date",
    "Bank Name",
    "Bank Account",
    "TIN",
    "RSA PIN",
    "NHF Number",
    "Basic Salary (NGN)",
    "Housing Allowance (NGN)",
    "Transport Allowance (NGN)",
    "Other Taxable Allowances (NGN)",
    "Non-Taxable Reimbursements (NGN)",
    "Annual Rent (NGN)",
    "Next of Kin",
    "Next of Kin Phone",
  ];

  const rows = employees.map((e) => [
    e.employeeCode,
    e.firstName,
    e.lastName,
    e.department,
    e.jobTitle,
    e.employmentType,
    e.status,
    e.startDate.toISOString().slice(0, 10),
    e.bankName ?? "",
    e.bankAccountNumber ?? "",
    e.tin ?? "",
    e.rsaPin ?? "",
    e.nhfNumber ?? "",
    formatNairaFromKobo(e.basicSalaryKobo),
    formatNairaFromKobo(e.housingAllowanceKobo),
    formatNairaFromKobo(e.transportAllowanceKobo),
    formatNairaFromKobo(e.otherTaxableAllowancesKobo),
    formatNairaFromKobo(e.nonTaxableReimbursementsKobo),
    formatNairaFromKobo(e.annualRentKobo),
    e.nextOfKinName ?? "",
    e.nextOfKinPhone ?? "",
  ]);

  const date = new Date().toISOString().slice(0, 10);
  return {
    csv: buildCsv(headers, rows),
    filename: `staff-export-${date}.csv`,
    rowCount: employees.length,
  };
}
