import { applyRateBps, maxKobo, minKobo, sumKobo } from "@/lib/money";
import type { Kobo } from "@/lib/money";
import type { PayeBreakdown, StatutoryConfigInput, TaxBandConfig } from "./types";

export function getPensionableEmoluments(
  basic: Kobo,
  housing: Kobo,
  transport: Kobo
): Kobo {
  return sumKobo(basic, housing, transport);
}

export function calculateAnnualRentRelief(
  annualRentKobo: Kobo,
  rentReliefCapKobo: Kobo
): Kobo {
  const twentyPercent = applyRateBps(annualRentKobo, 2000);
  return minKobo(twentyPercent, rentReliefCapKobo);
}

export function calculateTaxRelief(
  annualGrossKobo: Kobo,
  config: StatutoryConfigInput,
  annualRentKobo: Kobo = 0n
): Kobo {
  if (config.taxReliefMode === "NTA2025") {
    const rentRelief = calculateAnnualRentRelief(
      annualRentKobo,
      config.rentReliefCapKobo
    );
    return config.taxFreeThresholdKobo + rentRelief;
  }

  // Legacy CRA: higher of fixed or 1% of gross, plus 20% of gross
  const craBase = maxKobo(
    config.craFixedKobo,
    applyRateBps(annualGrossKobo, config.craPercentBps)
  );
  const craGross = applyRateBps(annualGrossKobo, config.craGrossPercentBps);
  return craBase + craGross;
}

export function calculateProgressiveTax(
  taxableIncomeKobo: Kobo,
  bands: TaxBandConfig[]
): { totalTaxKobo: Kobo; taxByBand: PayeBreakdown["taxByBand"] } {
  if (taxableIncomeKobo <= 0n) {
    return { totalTaxKobo: 0n, taxByBand: [] };
  }

  const sortedBands = [...bands].sort((a, b) =>
    Number(a.lowerBoundKobo - b.lowerBoundKobo)
  );

  let remaining = taxableIncomeKobo;
  let totalTax = 0n;
  const taxByBand: PayeBreakdown["taxByBand"] = [];

  for (const band of sortedBands) {
    if (remaining <= 0n) break;

    const bandWidth =
      band.upperBoundKobo === null
        ? remaining
        : band.upperBoundKobo - band.lowerBoundKobo;

    const taxableInBand = minKobo(remaining, bandWidth);
    if (taxableInBand <= 0n) continue;

    const tax = applyRateBps(taxableInBand, band.rateBps);
    totalTax += tax;

    const ratePercent = band.rateBps / 100;
    taxByBand.push({
      band: `${formatBandLabel(band)} @ ${ratePercent}%`,
      taxableKobo: taxableInBand,
      taxKobo: tax,
      rateBps: band.rateBps,
    });

    remaining -= taxableInBand;
  }

  return { totalTaxKobo: totalTax, taxByBand };
}

function formatBandLabel(band: TaxBandConfig): string {
  const lower = Number(band.lowerBoundKobo) / 100;
  if (band.upperBoundKobo === null) {
    return `Above ₦${lower.toLocaleString()}`;
  }
  const upper = Number(band.upperBoundKobo) / 100;
  return `₦${lower.toLocaleString()} – ₦${upper.toLocaleString()}`;
}

export function calculatePaye(
  monthlyGrossKobo: Kobo,
  monthlyPensionEmployeeKobo: Kobo,
  monthlyNhfKobo: Kobo,
  config: StatutoryConfigInput,
  annualRentKobo: Kobo = 0n
): PayeBreakdown {
  const annualGrossKobo = monthlyGrossKobo * 12n;
  const annualPensionEmployeeKobo = monthlyPensionEmployeeKobo * 12n;
  const annualNhfKobo = monthlyNhfKobo * 12n;

  const isMinimumWageExempt = annualGrossKobo <= config.minimumWageExemptKobo;

  if (isMinimumWageExempt) {
    return {
      annualGrossKobo,
      annualPensionEmployeeKobo,
      annualNhfKobo,
      annualRentReliefKobo: 0n,
      annualTaxReliefKobo: 0n,
      annualTaxableIncomeKobo: 0n,
      annualPayeKobo: 0n,
      monthlyPayeKobo: 0n,
      taxByBand: [],
      isMinimumWageExempt: true,
    };
  }

  const annualRentReliefKobo =
    config.taxReliefMode === "NTA2025"
      ? calculateAnnualRentRelief(annualRentKobo, config.rentReliefCapKobo)
      : 0n;

  const annualTaxReliefKobo = calculateTaxRelief(
    annualGrossKobo,
    config,
    annualRentKobo
  );

  const annualTaxableIncomeKobo = maxKobo(
    0n,
    annualGrossKobo -
      annualPensionEmployeeKobo -
      annualNhfKobo -
      annualTaxReliefKobo
  );

  const { totalTaxKobo: annualPayeKobo, taxByBand } = calculateProgressiveTax(
    annualTaxableIncomeKobo,
    config.taxBands
  );

  const monthlyPayeKobo = annualPayeKobo / 12n;

  return {
    annualGrossKobo,
    annualPensionEmployeeKobo,
    annualNhfKobo,
    annualRentReliefKobo,
    annualTaxReliefKobo,
    annualTaxableIncomeKobo,
    annualPayeKobo,
    monthlyPayeKobo,
    taxByBand,
    isMinimumWageExempt: false,
  };
}

/** Default NTA 2025 tax bands (annual, in kobo) */
export const DEFAULT_NTA2025_TAX_BANDS: TaxBandConfig[] = [
  { lowerBoundKobo: 0n, upperBoundKobo: 80000000n, rateBps: 0 },
  { lowerBoundKobo: 80000000n, upperBoundKobo: 300000000n, rateBps: 1500 },
  { lowerBoundKobo: 300000000n, upperBoundKobo: 1200000000n, rateBps: 1800 },
  { lowerBoundKobo: 1200000000n, upperBoundKobo: 2500000000n, rateBps: 2100 },
  { lowerBoundKobo: 2500000000n, upperBoundKobo: 5000000000n, rateBps: 2300 },
  { lowerBoundKobo: 5000000000n, upperBoundKobo: null, rateBps: 2500 },
];

/** Legacy PITA bands with CRA (pre-2026) */
export const DEFAULT_LEGACY_TAX_BANDS: TaxBandConfig[] = [
  { lowerBoundKobo: 0n, upperBoundKobo: 30000000n, rateBps: 700 },
  { lowerBoundKobo: 30000000n, upperBoundKobo: 60000000n, rateBps: 1100 },
  { lowerBoundKobo: 60000000n, upperBoundKobo: 110000000n, rateBps: 1500 },
  { lowerBoundKobo: 110000000n, upperBoundKobo: 160000000n, rateBps: 1900 },
  { lowerBoundKobo: 160000000n, upperBoundKobo: 320000000n, rateBps: 2100 },
  { lowerBoundKobo: 320000000n, upperBoundKobo: null, rateBps: 2400 },
];
