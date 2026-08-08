import type { Kobo } from "@/lib/money";

export interface TaxBandConfig {
  lowerBoundKobo: Kobo;
  upperBoundKobo: Kobo | null;
  rateBps: number;
}

export interface StatutoryConfigInput {
  pensionEmployeeRateBps: number;
  pensionEmployerRateBps: number;
  nhfEnabled: boolean;
  nhfRateBps: number;
  nsitfRateBps: number;
  taxReliefMode: "NTA2025" | "CRA";
  taxFreeThresholdKobo: Kobo;
  craFixedKobo: Kobo;
  craPercentBps: number;
  craGrossPercentBps: number;
  rentReliefCapKobo: Kobo;
  minimumWageExemptKobo: Kobo;
  /** Payable working days for daily-rate deductions (default 22). */
  workingDaysPerMonth: number;
  taxBands: TaxBandConfig[];
}

export interface EmployeeCompensation {
  basicSalaryKobo: Kobo;
  housingAllowanceKobo: Kobo;
  transportAllowanceKobo: Kobo;
  otherTaxableAllowancesKobo: Kobo;
  nonTaxableReimbursementsKobo: Kobo;
  annualRentKobo?: Kobo;
}

export interface PayrollAdjustments {
  bonusKobo?: Kobo;
  loanDeductionKobo?: Kobo;
  advanceDeductionKobo?: Kobo;
  unpaidLeaveDeductionKobo?: Kobo;
  otherDeductionsKobo?: Kobo;
}

export interface PayrollPeriod {
  month: number;
  year: number;
}

export interface PayeBreakdown {
  annualGrossKobo: Kobo;
  annualPensionEmployeeKobo: Kobo;
  annualNhfKobo: Kobo;
  annualRentReliefKobo: Kobo;
  annualTaxReliefKobo: Kobo;
  annualTaxableIncomeKobo: Kobo;
  annualPayeKobo: Kobo;
  monthlyPayeKobo: Kobo;
  taxByBand: Array<{ band: string; taxableKobo: Kobo; taxKobo: Kobo; rateBps: number }>;
  isMinimumWageExempt: boolean;
}

export interface PayrollBreakdown {
  period: PayrollPeriod;
  earnings: {
    basicSalaryKobo: Kobo;
    housingAllowanceKobo: Kobo;
    transportAllowanceKobo: Kobo;
    otherAllowancesKobo: Kobo;
    bonusesKobo: Kobo;
    /** Paid but excluded from PAYE / NSITF base */
    nonTaxableReimbursementsKobo: Kobo;
    /** Taxable base used for PAYE */
    taxableGrossKobo: Kobo;
    /** Total earnings = taxable gross + non-taxable reimbursements */
    grossPayKobo: Kobo;
  };
  deductions: {
    payeKobo: Kobo;
    pensionEmployeeKobo: Kobo;
    nhfKobo: Kobo;
    loanDeductionKobo: Kobo;
    advanceDeductionKobo: Kobo;
    unpaidLeaveDeductionKobo: Kobo;
    otherDeductionsKobo: Kobo;
    totalDeductionsKobo: Kobo;
  };
  employerCosts: {
    pensionEmployerKobo: Kobo;
    nsitfKobo: Kobo;
    totalEmployerCostKobo: Kobo;
  };
  netPayKobo: Kobo;
  payeDetails: PayeBreakdown;
}
