import type { StatutoryConfig, TaxBand } from "@prisma/client";
import type { StatutoryConfigInput, TaxBandConfig } from "@/lib/payroll/types";
import { DEFAULT_NTA2025_TAX_BANDS } from "@/lib/payroll/paye";

export function mapTaxBands(bands: TaxBand[]): TaxBandConfig[] {
  return bands
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => ({
      lowerBoundKobo: b.lowerBoundKobo,
      upperBoundKobo: b.upperBoundKobo,
      rateBps: b.rateBps,
    }));
}

export function mapStatutoryConfig(
  config: StatutoryConfig | null,
  taxBands?: TaxBand[]
): StatutoryConfigInput {
  const bands =
    taxBands && taxBands.length > 0
      ? mapTaxBands(taxBands)
      : DEFAULT_NTA2025_TAX_BANDS;

  if (!config) {
    return {
      pensionEmployeeRateBps: 800,
      pensionEmployerRateBps: 1000,
      nhfEnabled: true,
      nhfRateBps: 250,
      nsitfRateBps: 100,
      taxReliefMode: "NTA2025",
      taxFreeThresholdKobo: 80000000n,
      craFixedKobo: 20000000n,
      craPercentBps: 100,
      craGrossPercentBps: 2000,
      rentReliefCapKobo: 50000000n,
      minimumWageExemptKobo: 84000000n,
      taxBands: bands,
    };
  }

  return {
    pensionEmployeeRateBps: config.pensionEmployeeRate,
    pensionEmployerRateBps: config.pensionEmployerRate,
    nhfEnabled: config.nhfEnabled,
    nhfRateBps: config.nhfRate,
    nsitfRateBps: config.nsitfRate,
    taxReliefMode: config.taxReliefMode as "NTA2025" | "CRA",
    taxFreeThresholdKobo: config.taxFreeThresholdKobo,
    craFixedKobo: config.craFixedKobo,
    craPercentBps: config.craPercentBps,
    craGrossPercentBps: config.craGrossPercentBps,
    rentReliefCapKobo: config.rentReliefCapKobo,
    minimumWageExemptKobo: config.minimumWageExemptKobo,
    taxBands: bands,
  };
}

export function serializeBigInts<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}
