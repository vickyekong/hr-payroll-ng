import { sumKobo } from "@/lib/money";
import type { Kobo } from "@/lib/money";
import { calculatePaye } from "./paye";
import { calculatePension } from "./pension";
import { calculateNhf } from "./nhf";
import { calculateNsitf } from "./nsitf";
import type {
  EmployeeCompensation,
  PayrollAdjustments,
  PayrollBreakdown,
  PayrollPeriod,
  StatutoryConfigInput,
} from "./types";

/** Default payable working days used for daily-rate deductions when company has no override. */
export const DEFAULT_WORKING_DAYS_PER_MONTH = 22;

/**
 * Taxable gross = basic + housing + transport + other taxable allowances + bonuses.
 * Non-taxable reimbursements are intentionally excluded.
 */
export function calculateTaxableGross(
  compensation: EmployeeCompensation,
  adjustments: PayrollAdjustments = {}
): Kobo {
  return sumKobo(
    compensation.basicSalaryKobo,
    compensation.housingAllowanceKobo,
    compensation.transportAllowanceKobo,
    compensation.otherTaxableAllowancesKobo,
    adjustments.bonusKobo ?? 0n
  );
}

/**
 * Total earnings (cash gross) = taxable gross + non-taxable reimbursements.
 * This is what the employee is paid before deductions; PAYE uses taxable gross only.
 */
export function calculateGrossPay(
  compensation: EmployeeCompensation,
  adjustments: PayrollAdjustments = {}
): Kobo {
  return sumKobo(
    calculateTaxableGross(compensation, adjustments),
    compensation.nonTaxableReimbursementsKobo
  );
}

export function calculatePayroll(
  compensation: EmployeeCompensation,
  config: StatutoryConfigInput,
  period: PayrollPeriod,
  adjustments: PayrollAdjustments = {}
): PayrollBreakdown {
  const bonusesKobo = adjustments.bonusKobo ?? 0n;
  const loanDeductionKobo = adjustments.loanDeductionKobo ?? 0n;
  const advanceDeductionKobo = adjustments.advanceDeductionKobo ?? 0n;
  const unpaidLeaveDeductionKobo = adjustments.unpaidLeaveDeductionKobo ?? 0n;
  const otherDeductionsKobo = adjustments.otherDeductionsKobo ?? 0n;

  const taxableGrossKobo = calculateTaxableGross(compensation, adjustments);
  const nonTaxableReimbursementsKobo =
    compensation.nonTaxableReimbursementsKobo;
  const grossPayKobo = calculateGrossPay(compensation, adjustments);

  const pension = calculatePension(
    compensation.basicSalaryKobo,
    compensation.housingAllowanceKobo,
    compensation.transportAllowanceKobo,
    config.pensionEmployeeRateBps,
    config.pensionEmployerRateBps
  );

  const nhfKobo = calculateNhf(
    compensation.basicSalaryKobo,
    config.nhfEnabled,
    config.nhfRateBps
  );

  // PAYE + min-wage test use taxable gross only (exclude reimbursements)
  const payeDetails = calculatePaye(
    taxableGrossKobo,
    pension.employeeContributionKobo,
    nhfKobo,
    config,
    compensation.annualRentKobo ?? 0n
  );

  // NSITF is an employer levy on taxable emoluments / payroll (not pure reimbursements)
  const nsitfKobo = calculateNsitf(taxableGrossKobo, config.nsitfRateBps);

  const totalEmployeeDeductions = sumKobo(
    payeDetails.monthlyPayeKobo,
    pension.employeeContributionKobo,
    nhfKobo,
    loanDeductionKobo,
    advanceDeductionKobo,
    unpaidLeaveDeductionKobo,
    otherDeductionsKobo
  );

  const netPayKobo = grossPayKobo - totalEmployeeDeductions;

  return {
    period,
    earnings: {
      basicSalaryKobo: compensation.basicSalaryKobo,
      housingAllowanceKobo: compensation.housingAllowanceKobo,
      transportAllowanceKobo: compensation.transportAllowanceKobo,
      otherAllowancesKobo: compensation.otherTaxableAllowancesKobo,
      bonusesKobo,
      nonTaxableReimbursementsKobo,
      taxableGrossKobo,
      grossPayKobo,
    },
    deductions: {
      payeKobo: payeDetails.monthlyPayeKobo,
      pensionEmployeeKobo: pension.employeeContributionKobo,
      nhfKobo,
      loanDeductionKobo,
      advanceDeductionKobo,
      unpaidLeaveDeductionKobo,
      otherDeductionsKobo,
      totalDeductionsKobo: totalEmployeeDeductions,
    },
    employerCosts: {
      pensionEmployerKobo: pension.employerContributionKobo,
      nsitfKobo,
      totalEmployerCostKobo: sumKobo(
        grossPayKobo,
        pension.employerContributionKobo,
        nsitfKobo
      ),
    },
    netPayKobo,
    payeDetails,
  };
}

export function calculateUnpaidLeaveDeduction(
  dailyRateKobo: Kobo,
  unpaidDays: number
): Kobo {
  return dailyRateKobo * BigInt(unpaidDays);
}

/**
 * Daily rate from a monthly amount using company working-days setting.
 * Defaults to 22 when not provided.
 */
export function getDailyRateFromMonthly(
  monthlyAmountKobo: Kobo,
  workingDaysPerMonth: number = DEFAULT_WORKING_DAYS_PER_MONTH
): Kobo {
  const days = Math.max(1, Math.floor(workingDaysPerMonth));
  return monthlyAmountKobo / BigInt(days);
}
