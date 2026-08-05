import { calculatePayroll } from "@/lib/payroll/calculate-payroll";
import type { StatutoryConfigInput } from "@/lib/payroll/types";
import { nairaToKobo } from "@/lib/money";

export interface HireScenarioInput {
  /** Number of hires to model */
  headcount: number;
  /** Monthly basic in Naira */
  basicNaira: number;
  housingNaira?: number;
  transportNaira?: number;
  otherAllowancesNaira?: number;
  label?: string;
  periodMonth?: number;
  periodYear?: number;
}

export interface HireScenarioResult {
  label: string;
  headcount: number;
  perHire: {
    basicKobo: string;
    grossKobo: string;
    netKobo: string;
    payeKobo: string;
    pensionEmployeeKobo: string;
    pensionEmployerKobo: string;
    nhfKobo: string;
    nsitfKobo: string;
    employerCostKobo: string;
  };
  monthly: {
    grossKobo: string;
    netKobo: string;
    payeKobo: string;
    pensionEmployeeKobo: string;
    pensionEmployerKobo: string;
    nhfKobo: string;
    nsitfKobo: string;
    employerCostKobo: string;
  };
  annualEmployerCostKobo: string;
}

function mul(kobo: bigint, n: number): bigint {
  return kobo * BigInt(n);
}

export function forecastHireScenario(
  config: StatutoryConfigInput,
  input: HireScenarioInput
): HireScenarioResult {
  const headcount = Math.max(0, Math.floor(input.headcount));
  const now = new Date();
  const period = {
    month: input.periodMonth ?? now.getMonth() + 1,
    year: input.periodYear ?? now.getFullYear(),
  };

  const compensation = {
    basicSalaryKobo: nairaToKobo(input.basicNaira),
    housingAllowanceKobo: nairaToKobo(input.housingNaira ?? 0),
    transportAllowanceKobo: nairaToKobo(input.transportNaira ?? 0),
    otherTaxableAllowancesKobo: nairaToKobo(input.otherAllowancesNaira ?? 0),
    nonTaxableReimbursementsKobo: 0n,
    annualRentKobo: 0n,
  };

  const calc = calculatePayroll(compensation, config, period);
  const employerCost =
    calc.earnings.grossPayKobo +
    calc.employerCosts.pensionEmployerKobo +
    calc.employerCosts.nsitfKobo;

  const perHire = {
    basicKobo: compensation.basicSalaryKobo.toString(),
    grossKobo: calc.earnings.grossPayKobo.toString(),
    netKobo: calc.netPayKobo.toString(),
    payeKobo: calc.deductions.payeKobo.toString(),
    pensionEmployeeKobo: calc.deductions.pensionEmployeeKobo.toString(),
    pensionEmployerKobo: calc.employerCosts.pensionEmployerKobo.toString(),
    nhfKobo: calc.deductions.nhfKobo.toString(),
    nsitfKobo: calc.employerCosts.nsitfKobo.toString(),
    employerCostKobo: employerCost.toString(),
  };

  return {
    label: input.label ?? `${headcount} hire(s)`,
    headcount,
    perHire,
    monthly: {
      grossKobo: mul(calc.earnings.grossPayKobo, headcount).toString(),
      netKobo: mul(calc.netPayKobo, headcount).toString(),
      payeKobo: mul(calc.deductions.payeKobo, headcount).toString(),
      pensionEmployeeKobo: mul(
        calc.deductions.pensionEmployeeKobo,
        headcount
      ).toString(),
      pensionEmployerKobo: mul(
        calc.employerCosts.pensionEmployerKobo,
        headcount
      ).toString(),
      nhfKobo: mul(calc.deductions.nhfKobo, headcount).toString(),
      nsitfKobo: mul(calc.employerCosts.nsitfKobo, headcount).toString(),
      employerCostKobo: mul(employerCost, headcount).toString(),
    },
    annualEmployerCostKobo: mul(employerCost, headcount * 12).toString(),
  };
}

export interface BaselineSnapshot {
  headcount: number;
  monthlyGrossKobo: string;
  monthlyNetKobo: string;
  monthlyEmployerCostKobo: string;
}

export function combineBaselineWithScenario(
  baseline: BaselineSnapshot | null,
  scenario: HireScenarioResult
) {
  if (!baseline) {
    return {
      projectedHeadcount: scenario.headcount,
      projectedGrossKobo: scenario.monthly.grossKobo,
      projectedNetKobo: scenario.monthly.netKobo,
      projectedEmployerCostKobo: scenario.monthly.employerCostKobo,
      deltaEmployerCostKobo: scenario.monthly.employerCostKobo,
    };
  }

  const projectedGross =
    BigInt(baseline.monthlyGrossKobo) + BigInt(scenario.monthly.grossKobo);
  const projectedNet =
    BigInt(baseline.monthlyNetKobo) + BigInt(scenario.monthly.netKobo);
  const projectedEmployer =
    BigInt(baseline.monthlyEmployerCostKobo) +
    BigInt(scenario.monthly.employerCostKobo);

  return {
    projectedHeadcount: baseline.headcount + scenario.headcount,
    projectedGrossKobo: projectedGross.toString(),
    projectedNetKobo: projectedNet.toString(),
    projectedEmployerCostKobo: projectedEmployer.toString(),
    deltaEmployerCostKobo: scenario.monthly.employerCostKobo,
  };
}
