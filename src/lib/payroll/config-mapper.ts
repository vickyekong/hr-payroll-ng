import type { StatutoryConfig, TaxBand } from "@prisma/client";
import type { StatutoryConfigInput, TaxBandConfig } from "@/lib/payroll/types";
import { DEFAULT_NTA2025_TAX_BANDS } from "@/lib/payroll/paye";
import { DEFAULT_WORKING_DAYS_PER_MONTH } from "@/lib/payroll/calculate-payroll";

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

  const workingDays =
    config &&
    "workingDaysPerMonth" in config &&
    typeof (config as { workingDaysPerMonth?: number }).workingDaysPerMonth ===
      "number"
      ? Math.max(
          1,
          (config as { workingDaysPerMonth: number }).workingDaysPerMonth
        )
      : DEFAULT_WORKING_DAYS_PER_MONTH;

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
      workingDaysPerMonth: DEFAULT_WORKING_DAYS_PER_MONTH,
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
    workingDaysPerMonth: workingDays,
    taxBands: bands,
  };
}

/** Revive a serialized statutory snapshot (string bigints → BigInt). */
export function reviveStatutorySnapshot(
  snapshot: unknown
): StatutoryConfigInput | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const raw = snapshot as Record<string, unknown>;
  if (!Array.isArray(raw.taxBands)) return null;

  const toKobo = (v: unknown, fallback: bigint) => {
    if (typeof v === "bigint") return v;
    if (typeof v === "string" && /^-?\d+$/.test(v)) return BigInt(v);
    if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
    return fallback;
  };

  return {
    pensionEmployeeRateBps: Number(raw.pensionEmployeeRateBps ?? 800),
    pensionEmployerRateBps: Number(raw.pensionEmployerRateBps ?? 1000),
    nhfEnabled: Boolean(raw.nhfEnabled ?? true),
    nhfRateBps: Number(raw.nhfRateBps ?? 250),
    nsitfRateBps: Number(raw.nsitfRateBps ?? 100),
    taxReliefMode: (raw.taxReliefMode === "CRA" ? "CRA" : "NTA2025") as
      | "NTA2025"
      | "CRA",
    taxFreeThresholdKobo: toKobo(raw.taxFreeThresholdKobo, 80000000n),
    craFixedKobo: toKobo(raw.craFixedKobo, 20000000n),
    craPercentBps: Number(raw.craPercentBps ?? 100),
    craGrossPercentBps: Number(raw.craGrossPercentBps ?? 2000),
    rentReliefCapKobo: toKobo(raw.rentReliefCapKobo, 50000000n),
    minimumWageExemptKobo: toKobo(raw.minimumWageExemptKobo, 84000000n),
    workingDaysPerMonth: Math.max(
      1,
      Number(raw.workingDaysPerMonth ?? DEFAULT_WORKING_DAYS_PER_MONTH)
    ),
    taxBands: (raw.taxBands as Array<Record<string, unknown>>).map((b) => ({
      lowerBoundKobo: toKobo(b.lowerBoundKobo, 0n),
      upperBoundKobo:
        b.upperBoundKobo == null ? null : toKobo(b.upperBoundKobo, 0n),
      rateBps: Number(b.rateBps ?? 0),
    })),
  };
}

export function serializeBigInts<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}
