import { applyRateBps } from "@/lib/money";
import type { Kobo } from "@/lib/money";
import { getPensionableEmoluments } from "./paye";

export interface PensionResult {
  pensionableEmolumentsKobo: Kobo;
  employeeContributionKobo: Kobo;
  employerContributionKobo: Kobo;
}

export function calculatePension(
  basicSalaryKobo: Kobo,
  housingAllowanceKobo: Kobo,
  transportAllowanceKobo: Kobo,
  employeeRateBps: number,
  employerRateBps: number
): PensionResult {
  const pensionableEmolumentsKobo = getPensionableEmoluments(
    basicSalaryKobo,
    housingAllowanceKobo,
    transportAllowanceKobo
  );

  return {
    pensionableEmolumentsKobo,
    employeeContributionKobo: applyRateBps(
      pensionableEmolumentsKobo,
      employeeRateBps
    ),
    employerContributionKobo: applyRateBps(
      pensionableEmolumentsKobo,
      employerRateBps
    ),
  };
}
