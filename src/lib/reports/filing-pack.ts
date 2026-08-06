import { prisma } from "@/lib/db";
import { getMonthName } from "@/lib/utils";
import {
  buildCsv,
  formatNairaFromKobo,
} from "@/lib/reports/csv";
import {
  buildRemittanceSchedule,
  sumRemittances,
} from "@/lib/reports/remittances";
import { createZipStore } from "@/lib/exports/zip";

export async function buildStatutoryFilingPack(
  companyId: string,
  runId: string
) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId },
    include: {
      company: {
        select: { name: true, address: true },
      },
      payslips: {
        include: {
          employee: {
            select: {
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: true,
              tin: true,
              rsaPin: true,
              nhfNumber: true,
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

  const periodLabel = `${getMonthName(run.periodMonth)} ${run.periodYear}`;
  const periodSlug = `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`;
  const totals = sumRemittances(run.payslips);
  const schedule = buildRemittanceSchedule(totals, periodLabel);

  const summaryCsv = buildCsv(
    ["Statutory Body", "Amount (NGN)", "Due Date", "Period", "Company", "Notes"],
    schedule.map((row) => [
      row.body,
      formatNairaFromKobo(row.amountKobo),
      row.dueDate,
      periodLabel,
      run.company.name,
      row.notes,
    ])
  );

  const payeCsv = buildCsv(
    [
      "Employee ID",
      "Name",
      "Department",
      "TIN",
      "Gross (NGN)",
      "PAYE (NGN)",
    ],
    run.payslips.map((p) => [
      p.employee.employeeCode,
      `${p.employee.firstName} ${p.employee.lastName}`,
      p.employee.department,
      p.employee.tin ?? "",
      formatNairaFromKobo(p.grossPayKobo),
      formatNairaFromKobo(p.payeKobo),
    ])
  );

  const pensionCsv = buildCsv(
    [
      "Employee ID",
      "Name",
      "RSA PIN",
      "Employee contribution (NGN)",
      "Employer contribution (NGN)",
      "Total (NGN)",
    ],
    run.payslips
      .filter((p) => p.pensionEmployeeKobo > 0n || p.pensionEmployerKobo > 0n)
      .map((p) => [
        p.employee.employeeCode,
        `${p.employee.firstName} ${p.employee.lastName}`,
        p.employee.rsaPin ?? "",
        formatNairaFromKobo(p.pensionEmployeeKobo),
        formatNairaFromKobo(p.pensionEmployerKobo),
        formatNairaFromKobo(p.pensionEmployeeKobo + p.pensionEmployerKobo),
      ])
  );

  const nhfCsv = buildCsv(
    ["Employee ID", "Name", "NHF Number", "NHF (NGN)"],
    run.payslips
      .filter((p) => p.nhfKobo > 0n)
      .map((p) => [
        p.employee.employeeCode,
        `${p.employee.firstName} ${p.employee.lastName}`,
        p.employee.nhfNumber ?? "",
        formatNairaFromKobo(p.nhfKobo),
      ])
  );

  const nsitfCsv = buildCsv(
    ["Employee ID", "Name", "Department", "NSITF employer (NGN)"],
    run.payslips
      .filter((p) => p.nsitfKobo > 0n)
      .map((p) => [
        p.employee.employeeCode,
        `${p.employee.firstName} ${p.employee.lastName}`,
        p.employee.department,
        formatNairaFromKobo(p.nsitfKobo),
      ])
  );

  const paymentCsv = buildCsv(
    [
      "Employee ID",
      "Name",
      "Bank",
      "Account Number",
      "Net Pay (NGN)",
    ],
    run.payslips.map((p) => [
      p.employee.employeeCode,
      `${p.employee.firstName} ${p.employee.lastName}`,
      p.employee.bankName ?? "",
      p.employee.bankAccountNumber ?? "",
      formatNairaFromKobo(p.netPayKobo),
    ])
  );

  const readme = [
    `OmniPeople — Statutory filing pack`,
    `Company: ${run.company.name}`,
    `Period: ${periodLabel}`,
    `Run status: ${run.status}`,
    `Payslips: ${run.payslips.length}`,
    ``,
    `Files:`,
    `  00-remittance-summary.csv  — PAYE / pension / NHF / NSITF totals & deadlines`,
    `  01-paye-by-employee.csv    — State IRS PAYE schedule`,
    `  02-pension-by-employee.csv — PFA remittance schedule`,
    `  03-nhf-by-employee.csv     — NHF deductions`,
    `  04-nsitf-by-employee.csv   — Employer NSITF`,
    `  05-bank-payment-list.csv   — Net pay for disbursement`,
    ``,
    `Note: These are ready-to-upload schedules. Confirm formats with your`,
    `State IRS / PFA / NHF portals before submission.`,
  ].join("\n");

  const files = [
    { name: "README.txt", content: readme },
    { name: "00-remittance-summary.csv", content: summaryCsv },
    { name: "01-paye-by-employee.csv", content: payeCsv },
    { name: "02-pension-by-employee.csv", content: pensionCsv },
    { name: "03-nhf-by-employee.csv", content: nhfCsv },
    { name: "04-nsitf-by-employee.csv", content: nsitfCsv },
    { name: "05-bank-payment-list.csv", content: paymentCsv },
  ];

  const zip = createZipStore(files);
  const filename = `filing-pack-${periodSlug}-${run.status.toLowerCase()}.zip`;

  return {
    filename,
    periodLabel,
    status: run.status,
    zip,
    fileCount: files.length,
  };
}
