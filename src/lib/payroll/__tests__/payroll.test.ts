import { describe, it, expect } from "vitest";
import { nairaToKobo } from "@/lib/money";
import { calculatePayroll, calculateUnpaidLeaveDeduction } from "@/lib/payroll/calculate-payroll";
import { calculatePension } from "@/lib/payroll/pension";
import { calculateNhf } from "@/lib/payroll/nhf";
import { calculateNsitf } from "@/lib/payroll/nsitf";
import { calculatePaye, DEFAULT_NTA2025_TAX_BANDS, DEFAULT_LEGACY_TAX_BANDS, calculateProgressiveTax, calculateTaxRelief, calculateAnnualRentRelief } from "@/lib/payroll/paye";
import type { StatutoryConfigInput } from "./types";

const defaultConfig: StatutoryConfigInput = {
  pensionEmployeeRateBps: 800,
  pensionEmployerRateBps: 1000,
  nhfEnabled: true,
  nhfRateBps: 250,
  nsitfRateBps: 100,
  taxReliefMode: "NTA2025",
  taxFreeThresholdKobo: nairaToKobo(800_000),
  craFixedKobo: nairaToKobo(200_000),
  craPercentBps: 100,
  craGrossPercentBps: 2000,
  rentReliefCapKobo: nairaToKobo(500_000),
  minimumWageExemptKobo: nairaToKobo(840_000),
  taxBands: DEFAULT_NTA2025_TAX_BANDS,
};

describe("Pension calculations", () => {
  it("calculates 8% employee and 10% employer on pensionable emoluments", () => {
    const basic = nairaToKobo(500_000);
    const housing = nairaToKobo(200_000);
    const transport = nairaToKobo(50_000);

    const result = calculatePension(basic, housing, transport, 800, 1000);

    expect(result.pensionableEmolumentsKobo).toBe(nairaToKobo(750_000));
    expect(result.employeeContributionKobo).toBe(nairaToKobo(60_000));
    expect(result.employerContributionKobo).toBe(nairaToKobo(75_000));
  });
});

describe("NHF calculations", () => {
  it("calculates 2.5% of basic salary when enabled", () => {
    const basic = nairaToKobo(500_000);
    expect(calculateNhf(basic, true, 250)).toBe(nairaToKobo(12_500));
  });

  it("returns zero when NHF is disabled", () => {
    const basic = nairaToKobo(500_000);
    expect(calculateNhf(basic, false, 250)).toBe(0n);
  });
});

describe("NSITF calculations", () => {
  it("calculates 1% of gross pay (employer cost)", () => {
    const gross = nairaToKobo(800_000);
    expect(calculateNsitf(gross, 100)).toBe(nairaToKobo(8_000));
  });
});

describe("PAYE calculations (NTA 2025)", () => {
  it("exempts minimum wage earners", () => {
    const monthlyGross = nairaToKobo(70_000);
    const pension = nairaToKobo(5_600);
    const nhf = nairaToKobo(1_750);

    const paye = calculatePaye(monthlyGross, pension, nhf, defaultConfig);
    expect(paye.isMinimumWageExempt).toBe(true);
    expect(paye.monthlyPayeKobo).toBe(0n);
  });

  it("calculates PAYE for mid-income earner with known example", () => {
    // Example: ₦500k basic + ₦200k housing + ₦50k transport = ₦750k gross
    const monthlyGross = nairaToKobo(750_000);
    const monthlyPension = nairaToKobo(60_000); // 8% of 750k
    const monthlyNhf = nairaToKobo(12_500); // 2.5% of 500k basic

    const paye = calculatePaye(monthlyGross, monthlyPension, monthlyNhf, defaultConfig);

    // Annual gross = 9,000,000
    // Annual pension = 720,000, NHF = 150,000
    // Taxable after ₦800k threshold = 9,000,000 - 720,000 - 150,000 - 800,000 = 7,330,000
    // Band 1 (0-800k): 0
    // Band 2 (800k-3M): 2,200,000 @ 15% = 330,000
    // Band 3 (3M-12M): 4,330,000 @ 18% = 779,400
    // Total annual PAYE = 1,109,400 → monthly ≈ 92,450
    expect(paye.annualTaxableIncomeKobo).toBe(nairaToKobo(7_330_000));
    expect(paye.annualPayeKobo).toBe(nairaToKobo(1_109_400));
    expect(paye.monthlyPayeKobo).toBe(nairaToKobo(92_450));
  });

  it("applies rent relief under NTA 2025", () => {
    const monthlyGross = nairaToKobo(750_000);
    const monthlyPension = nairaToKobo(60_000);
    const monthlyNhf = nairaToKobo(12_500);
    const annualRent = nairaToKobo(1_200_000); // 20% = 240k, capped at 500k

    const paye = calculatePaye(
      monthlyGross,
      monthlyPension,
      monthlyNhf,
      defaultConfig,
      annualRent
    );

    expect(paye.annualRentReliefKobo).toBe(nairaToKobo(240_000));
    // Tax relief = 800k + 240k = 1,040,000
    expect(paye.annualTaxReliefKobo).toBe(nairaToKobo(1_040_000));
  });

  it("caps rent relief at ₦500,000", () => {
    const relief = calculateAnnualRentRelief(
      nairaToKobo(5_000_000),
      nairaToKobo(500_000)
    );
    expect(relief).toBe(nairaToKobo(500_000));
  });

  it("exempts earners at exactly minimum wage annual threshold", () => {
    const monthlyGross = nairaToKobo(70_000); // 840k annual
    const paye = calculatePaye(monthlyGross, 0n, 0n, defaultConfig);
    expect(paye.isMinimumWageExempt).toBe(true);
  });

  it("does not exempt earners above minimum wage annual threshold", () => {
    const monthlyGross = nairaToKobo(71_000); // 852k annual > 840k threshold
    const paye = calculatePaye(monthlyGross, 0n, 0n, defaultConfig);
    expect(paye.isMinimumWageExempt).toBe(false);
    // Taxable 52k still falls entirely in the 0% band
    expect(paye.annualTaxableIncomeKobo).toBe(nairaToKobo(52_000));
    expect(paye.annualPayeKobo).toBe(0n);
  });

  it("applies 15% band once taxable income exceeds ₦800k", () => {
    const monthlyGross = nairaToKobo(150_000); // 1.8M annual → 1M taxable
    const paye = calculatePaye(monthlyGross, 0n, 0n, defaultConfig);
    expect(paye.annualTaxableIncomeKobo).toBe(nairaToKobo(1_000_000));
    // 800k @ 0% + 200k @ 15% = 30,000 annual
    expect(paye.annualPayeKobo).toBe(nairaToKobo(30_000));
  });

  it("matches published NTA 2025 marginal example (₦3.102M taxable)", () => {
    // Businessday NG worked example: taxable = 3,102,000 → annual PAYE = 348,360
    const taxable = nairaToKobo(3_102_000);
    const { totalTaxKobo } = calculateProgressiveTax(
      taxable,
      DEFAULT_NTA2025_TAX_BANDS
    );
    expect(totalTaxKobo).toBe(nairaToKobo(348_360));
  });

  it("calculates high earner tax across upper bands", () => {
    // ₦30M annual taxable → hits 21%, 23% bands
    const taxable = nairaToKobo(30_000_000);
    const { totalTaxKobo, taxByBand } = calculateProgressiveTax(
      taxable,
      DEFAULT_NTA2025_TAX_BANDS
    );
    expect(taxByBand.length).toBeGreaterThan(3);
    expect(totalTaxKobo).toBe(nairaToKobo(5_830_000));
  });

  it("uses CRA relief in legacy mode", () => {
    const legacyConfig: StatutoryConfigInput = {
      ...defaultConfig,
      taxReliefMode: "CRA",
      taxBands: DEFAULT_LEGACY_TAX_BANDS,
    };
    const annualGross = nairaToKobo(750_000) * 12n;
    const relief = calculateTaxRelief(annualGross, legacyConfig);
    // CRA: max(200k, 1% gross) + 20% gross = 200k + 1.8M = 2M
    expect(relief).toBe(nairaToKobo(2_000_000));
  });

  it("has zero PAYE when taxable income is within the 0% band", () => {
    const monthlyGross = nairaToKobo(100_000); // 1.2M annual → 400k taxable
    const paye = calculatePaye(monthlyGross, 0n, 0n, defaultConfig);
    expect(paye.annualTaxableIncomeKobo).toBe(nairaToKobo(400_000));
    expect(paye.monthlyPayeKobo).toBe(0n);
  });
});

describe("Full payroll calculation", () => {
  it("produces complete breakdown for standard employee", () => {
    const compensation = {
      basicSalaryKobo: nairaToKobo(500_000),
      housingAllowanceKobo: nairaToKobo(200_000),
      transportAllowanceKobo: nairaToKobo(50_000),
      otherTaxableAllowancesKobo: nairaToKobo(0),
      nonTaxableReimbursementsKobo: nairaToKobo(0),
    };

    const result = calculatePayroll(
      compensation,
      defaultConfig,
      { month: 1, year: 2026 }
    );

    expect(result.earnings.grossPayKobo).toBe(nairaToKobo(750_000));
    expect(result.deductions.pensionEmployeeKobo).toBe(nairaToKobo(60_000));
    expect(result.deductions.nhfKobo).toBe(nairaToKobo(12_500));
    expect(result.deductions.payeKobo).toBe(nairaToKobo(92_450));
    expect(result.employerCosts.pensionEmployerKobo).toBe(nairaToKobo(75_000));
    expect(result.employerCosts.nsitfKobo).toBe(nairaToKobo(7_500));

    const expectedNet =
      nairaToKobo(750_000) -
      nairaToKobo(60_000) -
      nairaToKobo(12_500) -
      nairaToKobo(92_450);
    expect(result.netPayKobo).toBe(expectedNet);
  });

  it("includes bonuses and loan deductions", () => {
    const compensation = {
      basicSalaryKobo: nairaToKobo(300_000),
      housingAllowanceKobo: nairaToKobo(100_000),
      transportAllowanceKobo: nairaToKobo(30_000),
      otherTaxableAllowancesKobo: nairaToKobo(0),
      nonTaxableReimbursementsKobo: nairaToKobo(0),
    };

    const result = calculatePayroll(
      compensation,
      defaultConfig,
      { month: 3, year: 2026 },
      {
        bonusKobo: nairaToKobo(50_000),
        loanDeductionKobo: nairaToKobo(20_000),
      }
    );

    expect(result.earnings.grossPayKobo).toBe(nairaToKobo(480_000));
    expect(result.deductions.loanDeductionKobo).toBe(nairaToKobo(20_000));
    expect(result.netPayKobo < result.earnings.grossPayKobo).toBe(true);
  });

  it("increases PAYE when bonus raises gross", () => {
    const compensation = {
      basicSalaryKobo: nairaToKobo(500_000),
      housingAllowanceKobo: nairaToKobo(200_000),
      transportAllowanceKobo: nairaToKobo(50_000),
      otherTaxableAllowancesKobo: nairaToKobo(0),
      nonTaxableReimbursementsKobo: nairaToKobo(0),
    };

    const base = calculatePayroll(compensation, defaultConfig, { month: 1, year: 2026 });
    const withBonus = calculatePayroll(
      compensation,
      defaultConfig,
      { month: 1, year: 2026 },
      { bonusKobo: nairaToKobo(100_000) }
    );

    expect(withBonus.deductions.payeKobo).toBeGreaterThan(base.deductions.payeKobo);
    expect(withBonus.earnings.grossPayKobo).toBe(nairaToKobo(850_000));
  });

  it("applies all deduction types to net pay", () => {
    const compensation = {
      basicSalaryKobo: nairaToKobo(400_000),
      housingAllowanceKobo: nairaToKobo(100_000),
      transportAllowanceKobo: nairaToKobo(50_000),
      otherTaxableAllowancesKobo: nairaToKobo(0),
      nonTaxableReimbursementsKobo: nairaToKobo(0),
    };

    const result = calculatePayroll(
      compensation,
      defaultConfig,
      { month: 6, year: 2026 },
      {
        bonusKobo: nairaToKobo(20_000),
        loanDeductionKobo: nairaToKobo(15_000),
        advanceDeductionKobo: nairaToKobo(10_000),
        unpaidLeaveDeductionKobo: nairaToKobo(5_000),
      }
    );

    const expectedNet =
      result.earnings.grossPayKobo -
      result.deductions.payeKobo -
      result.deductions.pensionEmployeeKobo -
      result.deductions.nhfKobo -
      nairaToKobo(15_000) -
      nairaToKobo(10_000) -
      nairaToKobo(5_000);

    expect(result.netPayKobo).toBe(expectedNet);
  });
});

describe("Unpaid leave deduction", () => {
  it("deducts daily rate × unpaid days", () => {
    const dailyRate = nairaToKobo(34_090); // ~750k / 22
    const deduction = calculateUnpaidLeaveDeduction(dailyRate, 3);
    expect(deduction).toBe(nairaToKobo(102_270));
  });
});
