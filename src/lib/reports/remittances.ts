import { prisma } from "@/lib/db";

export interface RemittanceTotals {
  paye: bigint;
  pensionEmployee: bigint;
  pensionEmployer: bigint;
  nhf: bigint;
  nsitf: bigint;
}

export interface RemittanceScheduleRow {
  body: string;
  amountKobo: bigint;
  dueDate: string;
  notes: string;
}

const DEADLINES = {
  paye: "10th of following month",
  pension: "7 working days after salary payment",
  nhf: "Within 30 days of deduction",
  nsitf: "Within 30 days of contribution",
};

export async function getApprovedPayrollRun(
  companyId: string,
  month: number,
  year: number
) {
  return prisma.payrollRun.findFirst({
    where: {
      companyId,
      periodMonth: month,
      periodYear: year,
      status: { in: ["APPROVED", "PAID"] },
    },
    include: {
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
            },
          },
        },
      },
      company: { select: { name: true } },
    },
  });
}

export function sumRemittances(
  payslips: Array<{
    payeKobo: bigint;
    pensionEmployeeKobo: bigint;
    pensionEmployerKobo: bigint;
    nhfKobo: bigint;
    nsitfKobo: bigint;
  }>
): RemittanceTotals {
  return payslips.reduce(
    (acc, p) => ({
      paye: acc.paye + p.payeKobo,
      pensionEmployee: acc.pensionEmployee + p.pensionEmployeeKobo,
      pensionEmployer: acc.pensionEmployer + p.pensionEmployerKobo,
      nhf: acc.nhf + p.nhfKobo,
      nsitf: acc.nsitf + p.nsitfKobo,
    }),
    {
      paye: 0n,
      pensionEmployee: 0n,
      pensionEmployer: 0n,
      nhf: 0n,
      nsitf: 0n,
    }
  );
}

export function buildRemittanceSchedule(
  totals: RemittanceTotals,
  periodLabel: string
): RemittanceScheduleRow[] {
  return [
    {
      body: "PAYE (State IRS)",
      amountKobo: totals.paye,
      dueDate: DEADLINES.paye,
      notes: "Remit to employee state of residence",
    },
    {
      body: "Pension — employee (PFA)",
      amountKobo: totals.pensionEmployee,
      dueDate: DEADLINES.pension,
      notes: "Employee contribution portion",
    },
    {
      body: "Pension — employer (PFA)",
      amountKobo: totals.pensionEmployer,
      dueDate: DEADLINES.pension,
      notes: "Employer contribution portion",
    },
    {
      body: "NHF",
      amountKobo: totals.nhf,
      dueDate: DEADLINES.nhf,
      notes: "National Housing Fund",
    },
    {
      body: "NSITF (employer)",
      amountKobo: totals.nsitf,
      dueDate: DEADLINES.nsitf,
      notes: "Employer-only; record-keeping",
    },
  ].map((row) => ({ ...row, notes: `${row.notes} · ${periodLabel}` }));
}

export { DEADLINES };
