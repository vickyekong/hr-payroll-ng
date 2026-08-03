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

export function calculateGrossPay(
  compensation: EmployeeCompensation,
  adjustments: PayrollAdjustments = {}
): Kobo {
  return sumKobo(
    compensation.basicSalaryKobo,
    compensation.housingAllowanceKobo,
    compensation.transportAllowanceKobo,
    compensation.otherTaxableAllowancesKobo,
    compensation.nonTaxableReimbursementsKobo,
    adjustments.bonusKobo ?? 0n
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

  const payeDetails = calculatePaye(
    grossPayKobo,
    pension.employeeContributionKobo,
    nhfKobo,
    config,
    compensation.annualRentKobo ?? 0n
  );

  const nsitfKobo = calculateNsitf(grossPayKobo, config.nsitfRateBps);

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

export function getDailyRateFromMonthly(monthlyGrossKobo: Kobo): Kobo {
  return monthlyGrossKobo / 22n; // standard working days per month
}
